// SPDX-License-Identifier: CC0-1.0
// SPDX-FileCopyrightText: No rights reserved

import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        files: ['*.js'],
        languageOptions: {
            globals: {
                ARGV: 'readonly',
                Debugger: 'readonly',
                GIRepositoryGType: 'readonly',
                globalThis: 'readonly',
                imports: 'readonly',
                Intl: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                pkg: 'readonly',
                print: 'readonly',
                printerr: 'readonly',
                window: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                // GNOME Shell Only
                global: 'readonly',
                C_: 'readonly',
                N_: 'readonly',
                ngettext: 'readonly',
            },
            sourceType: 'script',
            ecmaVersion: 2020,
        },
        rules: {
            'array-callback-return': 'error',
            'block-scoped-var': 'error',
            'eqeqeq': 'error',
            'no-array-constructor': 'error',
            'no-caller': 'error',
            'no-extend-native': 'error',
            'no-extra-bind': 'error',
            'no-extra-label': 'error',
            'no-iterator': 'error',
            'no-label-var': 'error',
            'no-loop-func': 'error',
            'no-new-object': 'error',
            'no-new-wrappers': 'error',
            'no-proto': 'error',
            'no-unused-vars': [
                'error',
                {
                    vars: 'local',
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                },
            ],
            'unicode-bom': 'error',
        },
    },
];
