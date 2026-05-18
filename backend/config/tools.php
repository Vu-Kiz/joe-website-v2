<?php

/*
 * Tool registry. Each entry defines a tool available on the platform.
 * public: true  — available to external subscribers via the store
 * public: false — JOE-internal only, never shown on the public store page
 *
 * To add a new tool to the public offering, set public: true here and
 * deploy. No DB changes needed — plans sell access to all public tools.
 */

return [
    'tools' => [
        [
            'key' => 'astrogation',
            'label' => 'Astrogation',
            'description' => 'Interactive galaxy map with system info, planets, hyperlanes, and AstroIntel personal travel events.',
            'public' => true,
        ],
        [
            'key' => 'hyper_planner',
            'label' => 'Hyper Planner',
            'description' => 'Hyperspace route plotter across the galaxy.',
            'public' => true,
        ],
        [
            'key' => 'entity_stats',
            'label' => 'Entity Stats',
            'description' => 'Full Star Wars Combine entity catalog browser with stats and comparisons.',
            'public' => true,
        ],
        [
            'key' => 'targeting_heatmap',
            'label' => 'Targeting Heatmap',
            'description' => 'Weapon firing arc and targeting heatmap sandbox.',
            'public' => true,
        ],
        [
            'key' => 'droidbrain',
            'label' => 'DroidBrain',
            'description' => 'Galactic intel feed powered by DroidBrain data.',
            'public' => true,
        ],
        // Internal tools — never for sale
        [
            'key' => 'combat_calculator',
            'label' => 'Combat Calculator',
            'public' => false,
        ],
        [
            'key' => 'jobs',
            'label' => 'Jobs',
            'public' => false,
        ],
        [
            'key' => 'payments',
            'label' => 'Payments',
            'public' => false,
        ],
        [
            'key' => 'galactic_archive',
            'label' => 'Galactic Archive',
            'public' => false,
        ],
        [
            'key' => 'wrecking_helper',
            'label' => 'Wrecking Helper',
            'public' => false,
        ],
        [
            'key' => 'fleet_command',
            'label' => 'Fleet Command',
            'public' => false,
        ],
    ],
];
