module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2017,
        "sourceType": "module"
    },
    "globals": {
        "cc": true,
        "ig": true,
        "sc": true,
        "cc": true,
        "reloadTables": true,
        "entries": true,
        "$": true
    },
    "rules": {
        "indent": [
            "error",
            "tab"
        ],
        "linebreak-style": [
            "error",
            "windows"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-empty": [
            "warn" 
        ],
        "no-console": [
            "warn"
        ]
    }
};