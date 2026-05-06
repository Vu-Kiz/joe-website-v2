<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairDroidBrainShipCoordsCommand extends Command
{
    protected $signature = 'droidbrain:repair-ship-coords {--dry-run : Show what would be updated without making changes}';
    protected $description = 'Fix legacy ship system coordinates stored in surfx/surfy instead of sysx/sysy';

    public function handle(): void
    {
        $dryRun = $this->option('dry-run');

        $this->repairScanType($dryRun);
        $this->repairShipsType($dryRun);
    }

    private function repairScanType(bool $dryRun): void
    {
        // Legacy "Scan" and "system_scans" files: the old upload code stored each ship's
        // <x>/<y> from the RSS item into surfx/surfy instead of sysx/sysy. All ships in
        // those files share the channel's system position in sysx/sysy. Move surfx→sysx.
        $payloadTypes = ['system_scans', 'Scan'];

        $count = DB::table('droidbrain_ships')
            ->join('droidbrain_files', 'droidbrain_files.id', '=', 'droidbrain_ships.file_id')
            ->whereIn('droidbrain_files.payload_type', $payloadTypes)
            ->whereNotNull('droidbrain_ships.surfx')
            ->count();

        if ($count === 0) {
            $this->info('Scan/system_scans: no rows to repair.');
            return;
        }

        $this->line("Scan/system_scans: found {$count} ships where surfx/surfy holds the real system grid position.");

        if ($dryRun) {
            $sample = DB::table('droidbrain_ships')
                ->join('droidbrain_files', 'droidbrain_files.id', '=', 'droidbrain_ships.file_id')
                ->whereIn('droidbrain_files.payload_type', $payloadTypes)
                ->whereNotNull('droidbrain_ships.surfx')
                ->select([
                    'droidbrain_ships.id',
                    'droidbrain_ships.entity_uid',
                    'droidbrain_ships.sysx',
                    'droidbrain_ships.sysy',
                    'droidbrain_ships.surfx',
                    'droidbrain_ships.surfy',
                    'droidbrain_files.payload_type',
                    'droidbrain_files.file_name',
                ])->limit(5)->get();

            foreach ($sample as $row) {
                $this->line("  [{$row->payload_type}] id={$row->id} uid={$row->entity_uid} sysx={$row->sysx}→{$row->surfx} sysy={$row->sysy}→{$row->surfy} file={$row->file_name}");
            }

            return;
        }

        DB::statement('
            UPDATE droidbrain_ships
            INNER JOIN droidbrain_files ON droidbrain_files.id = droidbrain_ships.file_id
            SET
                droidbrain_ships.sysx = droidbrain_ships.surfx,
                droidbrain_ships.sysy = droidbrain_ships.surfy,
                droidbrain_ships.surfx = NULL,
                droidbrain_ships.surfy = NULL
            WHERE droidbrain_files.payload_type IN (\'system_scans\', \'Scan\')
              AND droidbrain_ships.surfx IS NOT NULL
        ');

        $this->info("Scan/system_scans: moved surfx/surfy → sysx/sysy for {$count} ships.");
    }

    private function repairShipsType(bool $dryRun): void
    {
        // Legacy "Ships" INVENTORYLIST files: sysx/sysy already holds the correct
        // individual system grid position per ship. surfx/surfy is stale data from
        // before the planet surface feature existed — just clear it.
        $count = DB::table('droidbrain_ships')
            ->join('droidbrain_files', 'droidbrain_files.id', '=', 'droidbrain_ships.file_id')
            ->where('droidbrain_files.payload_type', 'Ships')
            ->whereNotNull('droidbrain_ships.surfx')
            ->count();

        if ($count === 0) {
            $this->info('Ships: no rows to repair.');
            return;
        }

        $this->line("Ships: found {$count} ships with stale surfx/surfy (sysx/sysy already correct).");

        if ($dryRun) {
            $sample = DB::table('droidbrain_ships')
                ->join('droidbrain_files', 'droidbrain_files.id', '=', 'droidbrain_ships.file_id')
                ->where('droidbrain_files.payload_type', 'Ships')
                ->whereNotNull('droidbrain_ships.surfx')
                ->select([
                    'droidbrain_ships.id',
                    'droidbrain_ships.entity_uid',
                    'droidbrain_ships.sysx',
                    'droidbrain_ships.sysy',
                    'droidbrain_ships.surfx',
                    'droidbrain_ships.surfy',
                    'droidbrain_files.file_name',
                ])->limit(5)->get();

            foreach ($sample as $row) {
                $this->line("  [Ships] id={$row->id} uid={$row->entity_uid} keeping sysx={$row->sysx} sysy={$row->sysy}, clearing surfx={$row->surfx} surfy={$row->surfy} file={$row->file_name}");
            }

            return;
        }

        DB::statement('
            UPDATE droidbrain_ships
            INNER JOIN droidbrain_files ON droidbrain_files.id = droidbrain_ships.file_id
            SET
                droidbrain_ships.surfx = NULL,
                droidbrain_ships.surfy = NULL
            WHERE droidbrain_files.payload_type = \'Ships\'
              AND droidbrain_ships.surfx IS NOT NULL
        ');

        $this->info("Ships: cleared stale surfx/surfy for {$count} ships.");
    }
}
