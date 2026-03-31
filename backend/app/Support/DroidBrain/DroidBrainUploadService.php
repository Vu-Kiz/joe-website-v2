<?php

namespace App\Support\DroidBrain;

use App\Models\SwcPlanetType;
use App\Models\SwcRace;
use App\Models\SwcShipType;
use App\Models\SwcStationType;
use App\Models\SwcVehicleType;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class DroidBrainUploadService
{
    public function ingest(UploadedFile $file, User $user): array
    {
        $rawXml = $file->get();
        if (!is_string($rawXml) || trim($rawXml) === '') {
            throw new \RuntimeException('The uploaded file was empty.');
        }

        $fileHash = hash('sha256', $rawXml);
        $existing = DB::table('droidbrain_files')->where('file_hash', $fileHash)->first();
        if (
            $existing
            && $this->fileHasImportedData((int) $existing->id)
            && !$this->shouldReimportLegacyBrokenDuplicate($existing, $rawXml)
        ) {
            $existingCounts = $this->getFileEntityCounts((int) $existing->id);

            return [
                'file_id' => (int) $existing->id,
                'duplicate' => true,
                'payload_type' => (string) ($existing->payload_type ?? 'unknown'),
                'snapshot_unix' => $existing->snapshot_unix ? (int) $existing->snapshot_unix : null,
                'counts' => array_filter($existingCounts, fn ($value) => $value > 0),
                'message' => 'This upload was already imported previously.',
                'duplicate_attempt_status' => 'no_change',
                'duplicate_attempt_new_entities_count' => 0,
                'duplicate_attempt_modified_entities_count' => 0,
                'duplicate_attempt_unchanged_entities_count' => array_sum($existingCounts),
                'existing_change_status' => $existing->change_status ? (string) $existing->change_status : null,
                'existing_new_entities_count' => isset($existing->new_entities_count) ? (int) $existing->new_entities_count : 0,
                'existing_modified_entities_count' => isset($existing->modified_entities_count) ? (int) $existing->modified_entities_count : 0,
                'existing_unchanged_entities_count' => isset($existing->unchanged_entities_count) ? (int) $existing->unchanged_entities_count : 0,
            ];
        }

        $xml = $this->loadXml($rawXml);
        $snapshotUnix = $this->extractSnapshotUnix($xml);
        $uploaderId = $this->resolveUploaderId($user);
        $uploaderHandle = $this->resolveUserHandle($user);

        return DB::transaction(function () use ($file, $fileHash, $rawXml, $xml, $snapshotUnix, $uploaderId, $uploaderHandle, $user) {
            $collections = $this->extractCollections($xml);
            $payloadType = $this->detectPayloadType($collections, $file->getClientOriginalExtension());

            $fileId = DB::table('droidbrain_files')->insertGetId([
                'uploader_id' => $uploaderId,
                'file_name' => $file->getClientOriginalName() ?: 'droidbrain-upload.xml',
                'payload_type' => $payloadType,
                'inventory_version' => $this->extractVersion($xml),
                'snapshot_unix' => $snapshotUnix,
                'uploader_swc_uid' => $user->swc_character_id ? '1:' . $user->swc_character_id : null,
                'uploader_handle' => $uploaderHandle,
                'file_hash' => $fileHash,
                'change_status' => 'imported',
                'new_entities_count' => 0,
                'modified_entities_count' => 0,
                'unchanged_entities_count' => 0,
                'raw_xml' => $rawXml,
                'meta' => json_encode([
                    'source_extension' => strtolower($file->getClientOriginalExtension() ?: ''),
                ], JSON_UNESCAPED_SLASHES),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $counts = [
                'ships' => $this->importEntityRows($collections['ships'] ?? [], $fileId, $snapshotUnix, 'droidbrain_ships', fn ($node) => $this->parseShipNode($node, $fileId, $snapshotUnix)),
                'stations' => $this->importEntityRows($collections['stations'] ?? [], $fileId, $snapshotUnix, 'droidbrain_stations', fn ($node) => $this->parseStationNode($node, $fileId, $snapshotUnix)),
                'planets' => $this->importEntityRows($collections['planets'] ?? [], $fileId, $snapshotUnix, 'droidbrain_planets', fn ($node) => $this->parsePlanetNode($node, $fileId, $snapshotUnix)),
                'cities' => $this->importEntityRows($collections['cities'] ?? [], $fileId, $snapshotUnix, 'droidbrain_cities', fn ($node) => $this->parseCityNode($node, $fileId, $snapshotUnix)),
                'vehicles' => $this->importEntityRows($collections['vehicles'] ?? [], $fileId, $snapshotUnix, 'droidbrain_vehicles', fn ($node) => $this->parseVehicleNode($node, $fileId, $snapshotUnix)),
                'npcs' => $this->importEntityRows($collections['npcs'] ?? [], $fileId, $snapshotUnix, 'droidbrain_npcs', fn ($node) => $this->parseNpcNode($node, $fileId, $snapshotUnix)),
            ];

            $scanImport = $this->importSystemScans($collections['system_scans'] ?? [], $fileId, $snapshotUnix);
            foreach ($scanImport['entity_counts'] as $entityType => $entityCount) {
                if (!isset($counts[$entityType])) {
                    $counts[$entityType] = 0;
                }

                $counts[$entityType] += $entityCount;
            }

            $totalImported = array_sum($counts) + $scanImport['scan_count'];
            $newEntities = $scanImport['scan_count'] > 0
                ? (int) ($scanImport['state_counts']['new'] ?? 0)
                : $totalImported;
            $modifiedEntities = $scanImport['scan_count'] > 0
                ? (int) ($scanImport['state_counts']['modified'] ?? 0)
                : 0;
            $unchangedEntities = $scanImport['scan_count'] > 0
                ? (int) ($scanImport['state_counts']['unchanged'] ?? 0)
                : 0;
            DB::table('droidbrain_files')
                ->where('id', $fileId)
                ->update([
                    'change_status' => $newEntities > 0 ? 'new' : ($modifiedEntities > 0 ? 'modified' : 'no_change'),
                    'new_entities_count' => $newEntities,
                    'modified_entities_count' => $modifiedEntities,
                    'unchanged_entities_count' => $unchangedEntities,
                    'meta' => json_encode([
                        'source_extension' => strtolower($file->getClientOriginalExtension() ?: ''),
                        'scan_new_systems' => (int) ($scanImport['new_systems'] ?? 0),
                    ], JSON_UNESCAPED_SLASHES),
                    'updated_at' => now(),
                ]);

            if ($totalImported === 0) {
                throw new \RuntimeException(
                    'No supported DroidBrain XML or RSS records were found in that file. Detected structure: '
                    . $this->summarizeXmlShape($xml)
                );
            }

            if ($scanImport['scan_count'] > 0) {
                $counts['system_scans'] = $scanImport['scan_count'];
            }

            return [
                'file_id' => $fileId,
                'duplicate' => false,
                'payload_type' => $payloadType,
                'snapshot_unix' => $snapshotUnix,
                'counts' => array_filter($counts, fn ($value) => $value > 0),
                'message' => 'Upload imported successfully.',
                'duplicate_attempt_status' => null,
                'duplicate_attempt_new_entities_count' => null,
                'duplicate_attempt_modified_entities_count' => null,
                'duplicate_attempt_unchanged_entities_count' => null,
                'existing_change_status' => null,
                'existing_new_entities_count' => null,
                'existing_modified_entities_count' => null,
                'existing_unchanged_entities_count' => null,
            ];
        });
    }

    protected function fileHasImportedData(int $fileId): bool
    {
        return array_sum($this->getFileEntityCounts($fileId)) > 0;
    }

    protected function shouldReimportLegacyBrokenDuplicate(object $existing, string $rawXml): bool
    {
        $payloadType = trim((string) ($existing->payload_type ?? ''));
        if ($payloadType !== 'system_scans') {
            return false;
        }

        $itemCount = substr_count($rawXml, '<item>');
        if ($itemCount <= 1) {
            return false;
        }

        $counts = $this->getFileEntityCounts((int) $existing->id);
        $promotedEntities = (int) ($counts['ships'] ?? 0) + (int) ($counts['stations'] ?? 0);

        return $promotedEntities <= 1;
    }

    protected function getFileEntityCounts(int $fileId): array
    {
        $entityTables = [
            'ships' => 'droidbrain_ships',
            'stations' => 'droidbrain_stations',
            'planets' => 'droidbrain_planets',
            'cities' => 'droidbrain_cities',
            'vehicles' => 'droidbrain_vehicles',
            'npcs' => 'droidbrain_npcs',
            'system_scans' => 'droidbrain_system_scans',
        ];

        $counts = [];

        foreach ($entityTables as $key => $table) {
            $counts[$key] = DB::table($table)->where('file_id', $fileId)->count();
        }

        return $counts;
    }

    protected function resolveUploaderId(User $user): int
    {
        $swcUid = $user->swc_character_id ? '1:' . $user->swc_character_id : null;
        $handle = $this->resolveUserHandle($user);

        $existingId = DB::table('droidbrain_uploaders')
            ->where('user_id', $user->id)
            ->value('id');

        if ($existingId) {
            DB::table('droidbrain_uploaders')
                ->where('id', $existingId)
                ->update([
                    'swc_uid' => $swcUid,
                    'handle' => $handle,
                    'updated_at' => now(),
                ]);

            return (int) $existingId;
        }

        return (int) DB::table('droidbrain_uploaders')->insertGetId([
            'user_id' => $user->id,
            'swc_uid' => $swcUid,
            'handle' => $handle,
            'is_guest' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function resolveUserHandle(User $user): string
    {
        $candidates = [
            $user->swc_handle ?? null,
            $user->discord_global_name ?? null,
            $user->discord_username ?? null,
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return 'User #' . $user->id;
    }

    protected function loadXml(string $rawXml): \SimpleXMLElement
    {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($rawXml);
        if ($xml === false) {
            throw new \RuntimeException('Failed to parse the uploaded XML.');
        }

        $raw = $xml->asXML();
        if ($raw === false) {
            throw new \RuntimeException('Failed to serialize the uploaded XML.');
        }

        $clean = preg_replace('/xmlns="[^"]+"/', '', $raw, 1);
        if (!is_string($clean)) {
            throw new \RuntimeException('Failed to strip the XML namespace from the upload.');
        }

        $cleanXml = simplexml_load_string($clean);
        if ($cleanXml === false) {
            throw new \RuntimeException('Failed to reload the uploaded XML after namespace cleanup.');
        }

        return $cleanXml;
    }

    protected function extractVersion(\SimpleXMLElement $xml): ?string
    {
        $version = trim((string) ($xml['version'] ?? ''));
        return $version !== '' ? $version : null;
    }

    protected function extractSnapshotUnix(\SimpleXMLElement $xml): ?int
    {
        $candidates = [
            $xml['timestamp'] ?? null,
            $xml['inventory_unixtime'] ?? null,
            $xml['unixtime'] ?? null,
            $xml->timestamp ?? null,
            $xml->inventory_unixtime ?? null,
            $xml->unixtime ?? null,
        ];

        foreach ($candidates as $candidate) {
            $value = $this->toIntOrNull($candidate);
            if ($value !== null) {
                return $value;
            }
        }

        return time();
    }

    protected function extractCollections(\SimpleXMLElement $xml): array
    {
        if (strcasecmp($xml->getName(), 'rss') === 0 && isset($xml->channel) && isset($xml->channel->item)) {
            return [
                'ships' => [],
                'stations' => [],
                'planets' => [],
                'cities' => [],
                'vehicles' => [],
                'npcs' => [],
                'system_scans' => iterator_to_array($xml->channel->item, false),
            ];
        }

        if (strcasecmp($xml->getName(), 'INVENTORYLIST') === 0 && isset($xml->ENTITY)) {
            $entityType = strtoupper(trim((string) ($xml->ENTITY[0]->ENTITYTYPE_NAME ?? '')));
            $entities = iterator_to_array($xml->ENTITY, false);

            return [
                'ships' => $entityType === 'SHIPS' ? $entities : [],
                'stations' => $entityType === 'STATIONS' ? $entities : [],
                'planets' => $entityType === 'PLANETS' ? $entities : [],
                'cities' => $entityType === 'CITIES' ? $entities : [],
                'vehicles' => $entityType === 'VEHICLES' ? $entities : [],
                'npcs' => $entityType === 'NPCS' ? $entities : [],
                'system_scans' => [],
            ];
        }

        return [
            'ships' => $this->extractNodes($xml, ['ships'], ['ship']),
            'stations' => $this->extractNodes($xml, ['stations'], ['station']),
            'planets' => $this->extractNodes($xml, ['planets'], ['planet']),
            'cities' => $this->extractNodes($xml, ['cities'], ['city']),
            'vehicles' => $this->extractNodes($xml, ['vehicles'], ['vehicle']),
            'npcs' => $this->extractNodes($xml, ['npcs'], ['npc']),
            'system_scans' => $this->extractNodes($xml, ['systemscans', 'scans'], ['systemscan', 'scan']),
        ];
    }

    protected function extractNodes(\SimpleXMLElement $xml, array $containers, array $singularNames): array
    {
        foreach ($containers as $container) {
            $matches = $xml->xpath(sprintf('//%s', $container));
            if ($matches !== false) {
                foreach ($matches as $match) {
                    $rows = [];
                    foreach ($singularNames as $singular) {
                        foreach ($match->{$singular} as $entry) {
                            $rows[] = $entry;
                        }
                    }

                    if ($rows !== []) {
                        return $rows;
                    }
                }
            }
        }

        foreach ($singularNames as $singular) {
            $matches = $xml->xpath(sprintf('//%s', $singular));
            if ($matches !== false && $matches !== []) {
                return $matches;
            }
        }

        return [];
    }

    protected function detectPayloadType(array $collections, string $extension): string
    {
        $detected = array_keys(array_filter($collections, fn ($rows) => $rows !== []));
        if ($detected === []) {
            return strtolower($extension) === 'rss' ? 'rss_upload' : 'xml_upload';
        }

        if (count($detected) === 1) {
            return $detected[0];
        }

        return 'mixed_inventory';
    }

    protected function summarizeXmlShape(\SimpleXMLElement $xml): string
    {
        $root = $xml->getName();
        $children = [];

        foreach ($xml->children() as $child) {
            $children[] = $child->getName();
            if (count($children) >= 8) {
                break;
            }
        }

        $children = array_values(array_unique(array_filter($children)));

        if ($children === []) {
            return sprintf('root=%s', $root);
        }

        return sprintf('root=%s, children=%s', $root, implode(', ', $children));
    }

    protected function importEntityRows(array $nodes, int $fileId, ?int $snapshotUnix, string $table, callable $parser): int
    {
        if ($nodes === []) {
            return 0;
        }

        $rows = [];
        foreach ($nodes as $node) {
            $row = $parser($node);
            if ($row !== null) {
                $rows[] = $row;
            }
        }

        if ($rows !== []) {
            DB::table($table)->insert($rows);
        }

        return count($rows);
    }

    protected function importSystemScans(array $nodes, int $fileId, ?int $snapshotUnix): array
    {
        $scanCount = 0;
        $entityCounts = [
            'ships' => 0,
            'stations' => 0,
        ];
        $stateCounts = [
            'new' => 0,
            'modified' => 0,
            'unchanged' => 0,
        ];
        $newSystems = 0;

        foreach ($nodes as $node) {
            if ($node->getName() === 'item') {
                $channelNodes = $node->xpath('parent::*');
                $channel = ($channelNodes !== false && isset($channelNodes[0]) && $channelNodes[0] instanceof \SimpleXMLElement)
                    ? $channelNodes[0]
                    : null;

                $location = [
                    'galx' => $channel ? $this->toIntOrNull($channel->location->galX ?? null) : null,
                    'galy' => $channel ? $this->toIntOrNull($channel->location->galY ?? null) : null,
                    'sysx' => $channel ? $this->toIntOrNull($channel->location->sysX ?? null) : null,
                    'sysy' => $channel ? $this->toIntOrNull($channel->location->sysY ?? null) : null,
                    'system_name' => $this->extractScanSystemName($channel),
                ];

                $scanId = DB::table('droidbrain_system_scans')->insertGetId([
                    'file_id' => $fileId,
                    'snapshot_unixtime' => $this->resolveScanSnapshotUnix($channel, $snapshotUnix),
                    'galx' => $location['galx'] ?? 0,
                    'galy' => $location['galy'] ?? 0,
                    'system_uid' => null,
                    'system_name' => $location['system_name'],
                ]);

                if (($location['galx'] ?? null) !== null && ($location['galy'] ?? null) !== null) {
                    $inserted = DB::table('droidbrain_known_systems')->insertOrIgnore([
                        'system_uid' => null,
                        'system_name' => $location['system_name'] ?: 'Unknown',
                        'galx' => (int) $location['galx'],
                        'galy' => (int) $location['galy'],
                        'first_seen_file_id' => $fileId,
                        'first_seen_at' => now(),
                    ]);

                    if ($inserted > 0) {
                        $newSystems++;
                    }
                }

                DB::table('droidbrain_system_scan_objects')->insert([
                    'scan_id' => $scanId,
                    'object_type' => strtolower(trim((string) ($node->entityTypeName ?? ''))) ?: 'object',
                    'object_uid' => trim((string) ($node->entityUID ?? '')) ?: null,
                    'object_name' => trim((string) ($node->name ?? '')) ?: null,
                    'galx' => $location['galx'],
                    'galy' => $location['galy'],
                    'sysx' => $location['sysx'],
                    'sysy' => $location['sysy'],
                    'raw_json' => json_encode($this->simpleXmlToArray($node), JSON_UNESCAPED_SLASHES),
                ]);

                $entityType = strtolower(trim((string) ($node->entityTypeName ?? '')));
                if (in_array($entityType, ['ships', 'stations'], true)) {
                    $state = $this->importScanEntitySnapshot($node, $fileId, $this->resolveScanSnapshotUnix($channel, $snapshotUnix), $location);
                    $entityCounts[$entityType]++;
                    if (isset($stateCounts[$state])) {
                        $stateCounts[$state]++;
                    }
                }

                $scanCount++;
                continue;
            }

            $location = $this->extractLocation($node);
            $system = $this->extractReference($node, ['system']);
            $scanId = DB::table('droidbrain_system_scans')->insertGetId([
                'file_id' => $fileId,
                'snapshot_unixtime' => $this->toIntOrNull($node['timestamp'] ?? null) ?? $snapshotUnix ?? time(),
                'galx' => $location['galx'] ?? 0,
                'galy' => $location['galy'] ?? 0,
                'system_uid' => $system['uid'] ?? ($location['system_uid'] ?? null),
                'system_name' => $system['name'] ?? ($location['system_name'] ?? null),
            ]);

            $scanCount++;

            foreach ($this->extractNodes($node, ['objects'], ['object']) as $objectNode) {
                DB::table('droidbrain_system_scan_objects')->insert([
                    'scan_id' => $scanId,
                    'object_type' => strtolower(trim((string) ($objectNode['type'] ?? $objectNode->type ?? 'object'))) ?: 'object',
                    'object_uid' => $this->firstStringValue($objectNode, ['uid']),
                    'object_name' => $this->firstStringValue($objectNode, ['name']),
                    'galx' => $location['galx'],
                    'galy' => $location['galy'],
                    'sysx' => $this->toIntOrNull($objectNode['sysx'] ?? null),
                    'sysy' => $this->toIntOrNull($objectNode['sysy'] ?? null),
                    'raw_json' => json_encode($this->simpleXmlToArray($objectNode), JSON_UNESCAPED_SLASHES),
                ]);
            }
        }

        return [
            'scan_count' => $scanCount,
            'entity_counts' => array_filter($entityCounts, fn ($count) => $count > 0),
            'state_counts' => $stateCounts,
            'new_systems' => $newSystems,
        ];
    }

    protected function importScanEntitySnapshot(
        \SimpleXMLElement $node,
        int $fileId,
        int $snapshotUnix,
        array $location
    ): string {
        $entityType = strtolower(trim((string) ($node->entityTypeName ?? '')));
        $typeUid = trim((string) ($node->typeUID ?? '')) ?: null;
        $typeName = trim((string) ($node->typeName ?? '')) ?: null;
        $entityUid = trim((string) ($node->entityUID ?? '')) ?: null;
        $entityId = $this->toIntOrNull($node->entityID ?? null);
        if ($entityUid === null && $entityId !== null) {
            $entityUid = (string) $entityId;
        }
        $ownerName = trim((string) ($node->ownerName ?? '')) ?: '';
        $name = trim((string) ($node->name ?? '')) ?: '';
        $catalog = match ($entityType) {
            'ships' => $this->resolveScanCatalogDetails(SwcShipType::class, $typeUid, $typeName),
            'stations' => $this->resolveScanCatalogDetails(SwcStationType::class, $typeUid, $typeName),
            default => null,
        };
        $state = $this->classifyScanEntityState(
            $entityType === 'ships' ? 'droidbrain_ships' : 'droidbrain_stations',
            $entityUid,
            $ownerName,
            $name,
            $location['galx'] ?? null,
            $location['galy'] ?? null,
            $snapshotUnix
        );
        $tags = "scan\nstate:" . $state;

        if ($entityType === 'ships') {
            DB::table('droidbrain_ships')->insert([
                'file_id' => $fileId,
                'snapshot_unixtime' => $snapshotUnix,
                'entity_uid' => $entityUid,
                'entity_id' => $entityId ?? $this->extractEntityId($entityUid),
                'name' => $name ?: null,
                'owner_name' => $ownerName ?: null,
                'owner_uid' => trim((string) ($node->ownerUID ?? '')) ?: null,
                'owner_type' => $this->extractUidPrefix(trim((string) ($node->ownerUID ?? '')) ?: null),
                'system_name' => $location['system_name'],
                'galx' => $location['galx'],
                'galy' => $location['galy'],
                'sysx' => $location['sysx'],
                'sysy' => $location['sysy'],
                'surfx' => $this->toIntOrNull($node->x ?? null),
                'surfy' => $this->toIntOrNull($node->y ?? null),
                'class_name' => $catalog['class_name'] ?? null,
                'class_id' => null,
                'type_name' => $catalog['type_name'] ?? $typeName,
                'type_id' => $catalog['type_id'] ?? $this->extractEntityId($typeUid),
                'hull' => $this->toIntOrNull($node->hull ?? null),
                'hull_max' => $this->toIntOrNull($node->hullMax ?? null),
                'shield' => $this->toIntOrNull($node->shield ?? null),
                'shield_max' => $this->toIntOrNull($node->shieldMax ?? null),
                'ionic' => $this->toIntOrNull($node->ionic ?? null),
                'ionic_max' => $this->toIntOrNull($node->ionicMax ?? null),
                'public_status' => trim((string) ($node->iffStatus ?? '')) ?: null,
                'tags' => $tags,
            ]);

            return $state;
        }

        if ($entityType === 'stations') {
            DB::table('droidbrain_stations')->insert([
                'file_id' => $fileId,
                'snapshot_unixtime' => $snapshotUnix,
                'entity_uid' => $entityUid,
                'entity_id' => $entityId ?? $this->extractEntityId($entityUid),
                'name' => $name ?: null,
                'owner_name' => $ownerName ?: null,
                'owner_uid' => trim((string) ($node->ownerUID ?? '')) ?: null,
                'owner_type' => $this->extractUidPrefix(trim((string) ($node->ownerUID ?? '')) ?: null),
                'system_name' => $location['system_name'],
                'galx' => $location['galx'],
                'galy' => $location['galy'],
                'sysx' => $location['sysx'],
                'sysy' => $location['sysy'],
                'surfx' => $this->toIntOrNull($node->x ?? null),
                'surfy' => $this->toIntOrNull($node->y ?? null),
                'class_name' => $catalog['class_name'] ?? null,
                'class_id' => null,
                'type_name' => $catalog['type_name'] ?? $typeName,
                'type_id' => $catalog['type_id'] ?? $this->extractEntityId($typeUid),
                'hull' => $this->toIntOrNull($node->hull ?? null),
                'hull_max' => $this->toIntOrNull($node->hullMax ?? null),
                'shield' => $this->toIntOrNull($node->shield ?? null),
                'shield_max' => $this->toIntOrNull($node->shieldMax ?? null),
                'ionic' => $this->toIntOrNull($node->ionic ?? null),
                'ionic_max' => $this->toIntOrNull($node->ionicMax ?? null),
                'public_status' => trim((string) ($node->iffStatus ?? '')) ?: null,
                'tags' => $tags,
            ]);

            return $state;
        }

        return 'unchanged';
    }

    protected function parseShipNode(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $common = $this->parseCommonEntity($node, $fileId, $snapshotUnix);
        if ($common === null) {
            return null;
        }

        $type = $this->resolveCatalogReference(SwcShipType::class, $this->extractReference($node, ['type', 'shiptype']));

        return array_merge($common, [
            'type_id' => $type['id'],
            'type_name' => $type['store_name'],
            'class_id' => null,
            'class_name' => null,
            'hull' => $this->firstIntValue($node, ['hull']),
            'hull_max' => $this->firstIntValue($node, ['hullmax', 'maxhull']),
            'shield' => $this->firstIntValue($node, ['shield']),
            'shield_max' => $this->firstIntValue($node, ['shieldmax', 'maxshield']),
            'ionic' => $this->firstIntValue($node, ['ionic']),
            'ionic_max' => $this->firstIntValue($node, ['ionicmax']),
            'passengers_remaining' => $this->firstIntValue($node, ['passengersremaining']),
            'passengers_total' => $this->firstIntValue($node, ['passengerstotal']),
            'volume_capacity_remaining' => $this->firstFloatValue($node, ['volumecapacityremaining']),
            'volume_capacity_total' => $this->firstFloatValue($node, ['volumecapacitytotal']),
            'weight_capacity_remaining' => $this->firstFloatValue($node, ['weightcapacityremaining']),
            'weight_capacity_total' => $this->firstFloatValue($node, ['weightcapacitytotal']),
            'public_status' => $this->firstStringValue($node, ['publicstatus']),
        ]);
    }

    protected function parseStationNode(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $common = $this->parseCommonEntity($node, $fileId, $snapshotUnix);
        if ($common === null) {
            return null;
        }

        $type = $this->resolveCatalogReference(SwcStationType::class, $this->extractReference($node, ['type', 'stationtype']));

        return array_merge($common, [
            'type_id' => $type['id'],
            'type_name' => $type['store_name'],
            'class_id' => null,
            'class_name' => null,
            'hull' => $this->firstIntValue($node, ['hull']),
            'hull_max' => $this->firstIntValue($node, ['hullmax', 'maxhull']),
            'shield' => $this->firstIntValue($node, ['shield']),
            'shield_max' => $this->firstIntValue($node, ['shieldmax', 'maxshield']),
            'ionic' => $this->firstIntValue($node, ['ionic']),
            'ionic_max' => $this->firstIntValue($node, ['ionicmax']),
            'passengers_remaining' => $this->firstIntValue($node, ['passengersremaining']),
            'passengers_total' => $this->firstIntValue($node, ['passengerstotal']),
            'volume_capacity_remaining' => $this->firstFloatValue($node, ['volumecapacityremaining']),
            'volume_capacity_total' => $this->firstFloatValue($node, ['volumecapacitytotal']),
            'weight_capacity_remaining' => $this->firstFloatValue($node, ['weightcapacityremaining']),
            'weight_capacity_total' => $this->firstFloatValue($node, ['weightcapacitytotal']),
            'public_status' => $this->firstStringValue($node, ['publicstatus']),
            'construction_status' => $this->firstStringValue($node, ['constructionstatus']),
            'production_status' => $this->firstStringValue($node, ['productionstatus']),
            'tooled_to' => $this->firstStringValue($node, ['tooledto']),
        ]);
    }

    protected function parseVehicleNode(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $common = $this->parseCommonEntity($node, $fileId, $snapshotUnix);
        if ($common === null) {
            return null;
        }

        $type = $this->resolveCatalogReference(SwcVehicleType::class, $this->extractReference($node, ['type', 'vehicletype']));

        return array_merge($common, [
            'type_id' => $type['id'],
            'type_name' => $type['store_name'],
            'class_id' => null,
            'class_name' => null,
            'hull' => $this->firstIntValue($node, ['hull']),
            'hull_max' => $this->firstIntValue($node, ['hullmax', 'maxhull']),
            'shield' => $this->firstIntValue($node, ['shield']),
            'shield_max' => $this->firstIntValue($node, ['shieldmax', 'maxshield']),
            'ionic' => $this->firstIntValue($node, ['ionic']),
            'ionic_max' => $this->firstIntValue($node, ['ionicmax']),
            'passengers_remaining' => $this->firstIntValue($node, ['passengersremaining']),
            'passengers_total' => $this->firstIntValue($node, ['passengerstotal']),
            'volume_capacity_remaining' => $this->firstFloatValue($node, ['volumecapacityremaining']),
            'volume_capacity_total' => $this->firstFloatValue($node, ['volumecapacitytotal']),
            'public_status' => $this->firstStringValue($node, ['publicstatus']),
        ]);
    }

    protected function parsePlanetNode(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $common = $this->parseCommonEntity($node, $fileId, $snapshotUnix);
        if ($common === null) {
            return null;
        }

        $type = $this->resolveCatalogReference(SwcPlanetType::class, $this->extractReference($node, ['type', 'planettype']));

        return array_merge($common, [
            'type_id' => $type['id'],
            'planet_type_name' => $type['store_name'],
            'size' => $this->firstIntValue($node, ['size']),
            'tax_level' => $this->firstFloatValue($node, ['taxlevel']),
            'morale' => $this->firstFloatValue($node, ['morale']),
            'crime' => $this->firstFloatValue($node, ['crime']),
            'er' => $this->firstFloatValue($node, ['er']),
            'civ_level' => $this->firstFloatValue($node, ['civlevel']),
            'government' => $this->firstStringValue($node, ['government']),
            'population' => $this->toIntOrNull($node->population ?? null),
            'hirable_population' => $this->firstIntValue($node, ['hirablepopulation']),
            'hirable_pop' => $this->firstIntValue($node, ['hirablepop', 'hirablepopulation']),
        ]);
    }

    protected function parseCityNode(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $common = $this->parseCommonEntity($node, $fileId, $snapshotUnix);
        if ($common === null) {
            return null;
        }

        return array_merge($common, [
            'visible' => $this->toBoolOrNull($node->visible ?? null),
            'morale' => $this->firstFloatValue($node, ['morale']),
            'crime' => $this->firstFloatValue($node, ['crime']),
        ]);
    }

    protected function parseNpcNode(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $common = $this->parseCommonEntity($node, $fileId, $snapshotUnix);
        if ($common === null) {
            return null;
        }

        $race = $this->resolveCatalogReference(SwcRace::class, $this->extractReference($node, ['race', 'racetype']));

        return array_merge($common, [
            'race_name' => $race['store_name'],
            'race_id' => $race['id'],
            'class_name' => $this->firstStringValue($node, ['class', 'classname']),
            'hp' => $this->firstIntValue($node, ['hp']),
            'hp_max' => $this->firstIntValue($node, ['hpmax']),
            'xp' => $this->firstIntValue($node, ['xp']),
            'xp_level' => $this->firstIntValue($node, ['xplevel']),
        ]);
    }

    protected function parseCommonEntity(\SimpleXMLElement $node, int $fileId, ?int $snapshotUnix): ?array
    {
        $entityUid = $this->firstStringValue($node, ['uid', 'UID']);
        $entityId = $this->firstIntValue($node, ['entityID', 'ENTITYID']);
        if ($entityUid === null && $entityId !== null) {
            $entityUid = (string) $entityId;
        }
        $name = $this->firstStringValue($node, ['name', 'NAME']);

        if ($entityUid === null && $name === null) {
            return null;
        }

        $owner = $this->extractReference($node, ['owner', 'government', 'faction', 'controlledby']);
        $commander = $this->extractReference($node, ['commander']);
        $pilot = $this->extractReference($node, ['pilot']);
        $supervisor = $this->extractReference($node, ['supervisor']);
        $city = $this->extractReference($node, ['city']);
        $location = $this->extractLocation($node);
        $container = $this->extractReference($node, ['container']);
        $containerType = $this->extractReference($node, ['containertype']);

        return [
            'file_id' => $fileId,
            'snapshot_unixtime' => $snapshotUnix ?? time(),
            'entity_uid' => $entityUid,
            'entity_id' => $entityId ?? $this->extractEntityId($entityUid),
            'name' => $name,
            'infotext' => $this->firstStringValue($node, ['infotext', 'INFOTEXT', 'description', 'desc']),
            'owner_name' => $owner['name'] ?? $this->firstStringValue($node, ['OWNER_NAME', 'GOVERNMENT']),
            'owner_type' => $this->firstIntValue($node, ['OWNER_TYPE']) ?? $this->extractUidPrefix($owner['uid']),
            'owner_uid' => $owner['uid'] ?? $this->firstStringValue($node, ['OWNER_UID']),
            'commander_name' => $commander['name'] ?? $this->firstStringValue($node, ['COMMANDER_NAME']),
            'commander_type' => $this->firstIntValue($node, ['COMMANDER_TYPE']) ?? $this->extractUidPrefix($commander['uid']),
            'commander_uid' => $commander['uid'] ?? $this->firstStringValue($node, ['COMMANDER_UID']),
            'pilot_name' => $pilot['name'] ?? $this->firstStringValue($node, ['PILOT_NAME']),
            'pilot_uid' => $pilot['uid'] ?? $this->firstStringValue($node, ['PILOT_UID']),
            'supervisor_name' => $supervisor['name'] ?? $this->firstStringValue($node, ['SUPERVISOR_NAME']),
            'supervisor_type' => $this->firstIntValue($node, ['SUPERVISOR_TYPE']) ?? $this->extractUidPrefix($supervisor['uid'] ?? null),
            'supervisor_uid' => $supervisor['uid'] ?? $this->firstStringValue($node, ['SUPERVISOR_UID']),
            'sector_uid' => $location['sector_uid'],
            'sector_name' => $location['sector_name'],
            'system_uid' => $location['system_uid'],
            'system_name' => $location['system_name'],
            'planet_uid' => $location['planet_uid'],
            'planet_name' => $location['planet_name'],
            'city_uid' => $city['uid'] ?? $this->firstStringValue($node, ['CITY_UID']),
            'city_name' => $city['name'] ?? $this->firstStringValue($node, ['CITY']),
            'galx' => $location['galx'],
            'galy' => $location['galy'],
            'sysx' => $location['sysx'],
            'sysy' => $location['sysy'],
            'surfx' => $location['surfx'],
            'surfy' => $location['surfy'],
            'groundx' => $location['groundx'],
            'groundy' => $location['groundy'],
            'container' => $this->firstIntValue($node, ['container', 'CONTAINER']),
            'container_type_uid' => $containerType['uid'] ?? $this->firstStringValue($node, ['CONTAINER_TYPE_UID']),
            'container_type_name' => $containerType['name'] ?? $this->firstStringValue($node, ['CONTAINER_TYPE_NAME']),
            'container_type' => $this->firstIntValue($node, ['CONTAINERTYPE']) ?? $this->extractUidPrefix($containerType['uid'] ?? null),
            'container_uid' => $container['uid'] ?? $this->firstStringValue($node, ['CONTAINER_UID']),
            'container_class_name' => $this->firstStringValue($node, ['containerclassname', 'CONTAINER_CLASS_NAME']),
            'container_name' => $container['name'] ?? $this->firstStringValue($node, ['CONTAINER_NAME']),
            'protected' => $this->toBoolOrNull($node->protected ?? $node->PROTECTED ?? null),
            'tags' => $this->serializeTags($node),
        ];
    }

    protected function extractLocation(\SimpleXMLElement $node): array
    {
        $locationNode = $node->location ?? $node;

        $sector = $this->extractReference($locationNode, ['sector']);
        $system = $this->extractReference($locationNode, ['system']);
        $planet = $this->extractReference($locationNode, ['planet']);
        $coordinatesNode = $locationNode->coordinates ?? null;

        return [
            'sector_uid' => $sector['uid'] ?? $this->firstStringValue($node, ['SECTOR_UID']),
            'sector_name' => $sector['name'] ?? $this->firstStringValue($node, ['SECTOR']),
            'system_uid' => $system['uid'] ?? $this->firstStringValue($node, ['SYSTEM_UID']),
            'system_name' => $system['name'] ?? $this->firstStringValue($node, ['SYSTEM']),
            'planet_uid' => $planet['uid'] ?? $this->firstStringValue($node, ['PLANET_UID']),
            'planet_name' => $planet['name'] ?? $this->firstStringValue($node, ['PLANET']),
            'galx' => isset($coordinatesNode->galaxy) ? $this->toIntOrNull($coordinatesNode->galaxy['x'] ?? null) : $this->firstIntValue($node, ['GALX', 'galx']),
            'galy' => isset($coordinatesNode->galaxy) ? $this->toIntOrNull($coordinatesNode->galaxy['y'] ?? null) : $this->firstIntValue($node, ['GALY', 'galy']),
            'sysx' => isset($coordinatesNode->system) ? $this->toIntOrNull($coordinatesNode->system['x'] ?? null) : $this->firstIntValue($node, ['SYSX', 'sysx']),
            'sysy' => isset($coordinatesNode->system) ? $this->toIntOrNull($coordinatesNode->system['y'] ?? null) : $this->firstIntValue($node, ['SYSY', 'sysy']),
            'surfx' => isset($coordinatesNode->surface) ? $this->toIntOrNull($coordinatesNode->surface['x'] ?? null) : $this->firstIntValue($node, ['SURFX', 'surfx', 'X', 'x']),
            'surfy' => isset($coordinatesNode->surface) ? $this->toIntOrNull($coordinatesNode->surface['y'] ?? null) : $this->firstIntValue($node, ['SURFY', 'surfy', 'Y', 'y']),
            'groundx' => isset($coordinatesNode->ground) ? $this->toIntOrNull($coordinatesNode->ground['x'] ?? null) : $this->firstIntValue($node, ['GROUNDX', 'groundx']),
            'groundy' => isset($coordinatesNode->ground) ? $this->toIntOrNull($coordinatesNode->ground['y'] ?? null) : $this->firstIntValue($node, ['GROUNDY', 'groundy']),
        ];
    }

    protected function extractReference(\SimpleXMLElement $node, array $keys): array
    {
        foreach ($keys as $key) {
            if (!isset($node->{$key})) {
                continue;
            }

            $ref = $node->{$key};
            $uid = trim((string) ($ref['uid'] ?? '')) ?: null;
            $name = trim((string) ($ref['value'] ?? '')) ?: null;
            $name ??= trim((string) $ref) ?: null;
            $href = trim((string) ($ref['href'] ?? '')) ?: null;

            return [
                'uid' => $uid,
                'name' => $name,
                'href' => $href,
            ];
        }

        return [
            'uid' => null,
            'name' => null,
            'href' => null,
        ];
    }

    protected function resolveCatalogReference(string $modelClass, array $reference): array
    {
        /** @var \Illuminate\Database\Eloquent\Model $model */
        $model = new $modelClass();
        $query = $modelClass::query();

        if (($reference['uid'] ?? null) !== null && $this->tableHasColumn($model->getTable(), 'uid')) {
            $resolved = (clone $query)->where('uid', $reference['uid'])->first();
            if ($resolved) {
                return ['id' => $resolved->getKey(), 'store_name' => null];
            }
        }

        if (($reference['name'] ?? null) !== null && $this->tableHasColumn($model->getTable(), 'name')) {
            $resolved = (clone $query)->where('name', $reference['name'])->first();
            if ($resolved) {
                return ['id' => $resolved->getKey(), 'store_name' => null];
            }
        }

        return [
            'id' => null,
            'store_name' => $reference['name'] ?? null,
        ];
    }

    protected function resolveScanCatalogDetails(string $modelClass, ?string $uid, ?string $name): ?array
    {
        /** @var \Illuminate\Database\Eloquent\Model $model */
        $model = new $modelClass();
        $query = $modelClass::query();
        $resolved = null;

        if ($uid !== null && $this->tableHasColumn($model->getTable(), 'uid')) {
            $resolved = (clone $query)->where('uid', $uid)->first();
        }

        if (!$resolved && $name !== null && $this->tableHasColumn($model->getTable(), 'name')) {
            $resolved = (clone $query)->where('name', $name)->first();
        }

        if (!$resolved) {
            return null;
        }

        return [
            'type_id' => $this->extractEntityId($uid ?? ($resolved->uid ?? null)),
            'type_name' => $resolved->name ?? $name,
            'class_name' => $resolved->class_name ?? null,
        ];
    }

    protected function classifyScanEntityState(
        string $table,
        ?string $entityUid,
        string $ownerName,
        string $name,
        ?int $galx,
        ?int $galy,
        int $snapshotUnix
    ): string {
        if (!$entityUid) {
            return 'unchanged';
        }

        $latest = DB::table($table)
            ->where('entity_uid', $entityUid)
            ->orderByDesc('snapshot_unixtime')
            ->first(['snapshot_unixtime']);

        if (!$latest) {
            return 'new';
        }

        $sameState = DB::table($table)
            ->where('entity_uid', $entityUid)
            ->where('owner_name', $ownerName)
            ->where('name', $name)
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->exists();

        if ($sameState) {
            return 'unchanged';
        }

        $latestTime = (int) ($latest->snapshot_unixtime ?? 0);
        if ($latestTime > $snapshotUnix) {
            return 'unchanged';
        }

        return 'modified';
    }

    protected function tableHasColumn(string $table, string $column): bool
    {
        return DB::getSchemaBuilder()->hasColumn($table, $column);
    }

    protected function extractEntityId(?string $uid): ?int
    {
        if (!$uid || !str_contains($uid, ':')) {
            return null;
        }

        [, $rawId] = explode(':', $uid, 2);
        return $this->toIntOrNull($rawId);
    }

    protected function extractUidPrefix(?string $uid): ?int
    {
        if (!$uid || !str_contains($uid, ':')) {
            return null;
        }

        [$prefix] = explode(':', $uid, 2);
        return $this->toIntOrNull($prefix);
    }

    protected function serializeTags(\SimpleXMLElement $node): ?string
    {
        $flatTags = $this->firstStringValue($node, ['TAGS']);
        if ($flatTags !== null) {
            return $flatTags;
        }

        if (!isset($node->tags)) {
            return null;
        }

        $values = [];
        foreach ($node->tags->children() as $tag) {
            $value = trim((string) $tag);
            if ($value !== '') {
                $values[] = $value;
            }
        }

        return $values !== [] ? implode("\n", array_unique($values)) : null;
    }

    protected function firstStringValue(\SimpleXMLElement $node, array $keys): ?string
    {
        foreach ($keys as $key) {
            foreach (array_unique([$key, strtoupper($key)]) as $candidate) {
                if (!isset($node->{$candidate})) {
                    continue;
                }

                $valueNode = $node->{$candidate};
                $value = trim((string) $valueNode);
                if ($value !== '') {
                    return $value;
                }

                foreach (['value', 'name', 'uid'] as $attributeKey) {
                    $attributeValue = trim((string) ($valueNode[$attributeKey] ?? ''));
                    if ($attributeValue !== '') {
                        return $attributeValue;
                    }
                }
            }
        }

        return null;
    }

    protected function firstIntValue(\SimpleXMLElement $node, array $keys): ?int
    {
        foreach ($keys as $key) {
            foreach (array_unique([$key, strtoupper($key)]) as $candidate) {
                if (!isset($node->{$candidate})) {
                    continue;
                }

                $value = $this->toIntOrNull($node->{$candidate});
                if ($value !== null) {
                    return $value;
                }
            }
        }

        return null;
    }

    protected function firstFloatValue(\SimpleXMLElement $node, array $keys): ?float
    {
        foreach ($keys as $key) {
            foreach (array_unique([$key, strtoupper($key)]) as $candidate) {
                if (!isset($node->{$candidate})) {
                    continue;
                }

                $value = $this->toFloatOrNull($node->{$candidate});
                if ($value !== null) {
                    return $value;
                }
            }
        }

        return null;
    }

    protected function toIntOrNull(mixed $value): ?int
    {
        $string = trim((string) $value);
        if ($string === '' || !is_numeric($string)) {
            return null;
        }

        return (int) $string;
    }

    protected function toFloatOrNull(mixed $value): ?float
    {
        $string = trim((string) $value);
        if ($string === '' || !is_numeric($string)) {
            return null;
        }

        return (float) $string;
    }

    protected function toBoolOrNull(mixed $value): ?bool
    {
        $string = strtolower(trim((string) $value));

        return match ($string) {
            'yes', 'true', '1' => true,
            'no', 'false', '0' => false,
            default => null,
        };
    }

    protected function simpleXmlToArray(\SimpleXMLElement $node): array|string|null
    {
        $encoded = json_encode($node, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            return null;
        }

        return json_decode($encoded, true);
    }

    protected function extractScanSystemName(?\SimpleXMLElement $channel): ?string
    {
        if (!$channel) {
            return null;
        }

        $title = trim((string) ($channel->title ?? ''));
        if ($title === '') {
            return null;
        }

        if (preg_match('/Scan of\s+(.+?)\s*\(\s*[-0-9]+,\s*[-0-9]+\s*\)/i', $title, $matches)) {
            return trim($matches[1]) ?: null;
        }

        return $title;
    }

    protected function resolveScanSnapshotUnix(?\SimpleXMLElement $channel, ?int $fallback): int
    {
        if ($channel && isset($channel->lastBuildDate)) {
            $timestamp = strtotime((string) $channel->lastBuildDate);
            if ($timestamp !== false) {
                return $timestamp;
            }
        }

        return $fallback ?? time();
    }
}
