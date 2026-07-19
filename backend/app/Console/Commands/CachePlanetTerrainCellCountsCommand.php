<?php

namespace App\Console\Commands;

use App\Models\Swc\SwcPlanet;
use Illuminate\Console\Command;

class CachePlanetTerrainCellCountsCommand extends Command
{
    protected $signature = 'universe:cache-planet-terrain-counts
        {--only-missing : Skip planets that already have a cached count}';

    protected $description = 'Backfill valid_terrain_cell_count/terrain_cell_count on swc_planets from their terrain_grid/cities columns.';

    public function handle(): int
    {
        $onlyMissing = (bool) $this->option('only-missing');

        $query = SwcPlanet::query()->select(['id', 'terrain_grid', 'cities']);
        if ($onlyMissing) {
            $query->whereNull('terrain_cell_count');
        }

        $total = $query->count();
        $this->info("Caching terrain cell counts for {$total} planet(s)...");

        $bar = $this->output->createProgressBar($total);
        $updated = 0;

        $query->chunkById(200, function ($planets) use ($bar, &$updated) {
            foreach ($planets as $planet) {
                $counts = SwcPlanet::computeTerrainCellCounts(
                    (array) $planet->terrain_grid,
                    (array) $planet->cities
                );

                $planet->newQuery()
                    ->where('id', $planet->id)
                    ->update([
                        'valid_terrain_cell_count' => $counts['valid'],
                        'terrain_cell_count' => $counts['total'],
                    ]);

                $updated++;
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Done. Updated {$updated} planet(s).");

        return self::SUCCESS;
    }
}
