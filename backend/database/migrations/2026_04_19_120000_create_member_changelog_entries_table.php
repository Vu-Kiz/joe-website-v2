<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_changelog_entries', function (Blueprint $table): void {
            $table->id();
            $table->string('version', 20);
            $table->string('title');
            $table->text('details');
            $table->json('tools')->nullable();
            $table->json('audiences')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamp('released_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();
        $releasedAt = now()->setDate(2026, 4, 19)->setTime(0, 0, 0);

        DB::table('member_changelog_entries')->insert([
            [
                'version' => '2.0.5',
                'title' => 'Wrecking Helper Extension Platform',
                'details' => 'Added the member-facing extension workflow with website bridge connect, download packaging, shared settings, and per-user backend authorization.',
                'tools' => json_encode(['Wrecking Helper']),
                'audiences' => json_encode(['wreckingHelper', 'admin', 'sysadmin']),
                'sort_order' => 10,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Wrecking Helper Alt+Q Reliability',
                'details' => 'Stamping now retries after page load and applies confirmed cursor behavior automatically, removing the manual End-key workaround on slower board loads.',
                'tools' => json_encode(['Wrecking Helper']),
                'audiences' => json_encode(['wreckingHelper', 'admin', 'sysadmin']),
                'sort_order' => 11,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Targeting Heatmap Arc Parsing Fixes',
                'details' => 'Corrected mounted-weapon directional parsing for arc_from and arc_to records (including tractor beams) and expanded fallback arc-name coverage.',
                'tools' => json_encode(['Targeting Heatmap']),
                'audiences' => json_encode(['members', 'combatCalc', 'admin', 'sysadmin']),
                'sort_order' => 20,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Targeting Heatmap UX Refresh',
                'details' => 'Added collapsible sections, tightened heading visibility rules, simplified atmo sizing controls, and improved panel layout flow.',
                'tools' => json_encode(['Targeting Heatmap']),
                'audiences' => json_encode(['members', 'combatCalc', 'admin', 'sysadmin']),
                'sort_order' => 21,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Entity Stats Arc Indicator Accuracy',
                'details' => 'Arc indicators now render with explicit geometry so weapon and shield arc segments align with SWC direction conventions.',
                'tools' => json_encode(['Entity Stats']),
                'audiences' => json_encode(['members', 'admin', 'sysadmin']),
                'sort_order' => 30,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Combat Calculator Updates',
                'details' => 'Extended ship-targeting and simulation behavior while keeping access behind existing role gates.',
                'tools' => json_encode(['Combat Calculator']),
                'audiences' => json_encode(['combatCalc', 'admin', 'sysadmin']),
                'sort_order' => 40,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'DroidBrain Location Placement Improvements',
                'details' => 'Deep-space map placement and rendering were aligned with stored scan coordinates for more accurate ship and station positioning.',
                'tools' => json_encode(['DroidBrain', 'Astrogation']),
                'audiences' => json_encode(['droidbrain', 'admin', 'sysadmin']),
                'sort_order' => 50,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Payments Stability Improvements',
                'details' => 'Improved payments page resilience around queue issues and kept privileged actions scoped by role permissions.',
                'tools' => json_encode(['Payments']),
                'audiences' => json_encode(['payments', 'admin', 'sysadmin']),
                'sort_order' => 60,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'version' => '2.0.5',
                'title' => 'Members Tool View Persistence',
                'details' => 'Members tool selection now persists through URL state so refresh and navigation reopen the same tool context.',
                'tools' => json_encode(['Members Tools']),
                'audiences' => json_encode(['all']),
                'sort_order' => 70,
                'released_at' => $releasedAt,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('member_changelog_entries');
    }
};
