import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Los runners e2e en CommonJS se ejecutan con Node fuera del proyecto TypeScript:
  // el lint con projectService no puede resolverlos y los rechaza como error de parseo.
  { ignores: ['.wxt/**', '.output/**', 'node_modules/**', 'tests/e2e/**/*.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // El proyecto no admite `any`: la restriccion es parte del diseno,
      // porque el modelo de tres estados pierde todo su valor si se evade.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // El propio config no esta en el proyecto de TS: sin reglas con tipos.
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // La capa de dominio es pura: no puede tocar el DOM, la red ni el navegador.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'El dominio es puro: la extraccion vive en src/extraction.' },
        { name: 'window', message: 'El dominio es puro: la extraccion vive en src/extraction.' },
        { name: 'fetch', message: 'El dominio es puro: la red vive en src/transport.' },
        { name: 'chrome', message: 'El dominio es puro: las APIs de navegador viven en entrypoints.' },
      ],
    },
  },
);
