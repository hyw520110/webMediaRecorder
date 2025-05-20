module.exports = {
    root: true,
    env: {
        node: true,
        browser: true,
        es2021: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:vue/vue3-recommended',
        'plugin:prettier/recommended',
    ],
    parser: 'vue-eslint-parser',
    parserOptions: {
        parser: '@babel/eslint-parser',
        ecmaVersion: 2021,
        sourceType: 'module',
        requireConfigFile: false,
    },
    rules: {
        // Vue 模板缩进规则
        'vue/html-indent': [
            'error',
            4,
            {
                attribute: 1,
                baseIndent: 1,
                closeBracket: 0,
                alignAttributesVertically: true,
                ignores: [],
            },
        ],

        // Vue 脚本缩进规则
        'vue/script-indent': [
            'error',
            4,
            {
                baseIndent: 1,
                switchCase: 1,
                ignores: [
                    'ArrayExpression > *',
                    'ObjectExpression > *',
                    'CallExpression > Arguments > *',
                    'FunctionExpression > Params > *',
                ],
            },
        ],

        // 与 Prettier 集成规则
        'prettier/prettier': [
            'error',
            {
                endOfLine: 'auto',
                tabWidth: 4,
                useTabs: false,
                semi: false,
                singleQuote: true,
                htmlWhitespaceSensitivity: 'ignore',
            },
        ],

        'no-mixed-spaces-and-tabs': ['error', false],
    },
}
