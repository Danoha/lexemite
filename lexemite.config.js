/**
 * @type {import('lexemite').Config}
 */
module.exports = {
    
  plugins: [
    ['files', { include: '**/*', exclude: '**/node_modules' }],
    ['tests', { include: '**/__tests__/**/*', exclude: '**/node_modules' }],
    [
      'nodeResolver',
      {
        alias: { './lib/*.js': './src/*.ts' },
        extensions: ['.ts', '.js', '.json'],
        mainFields: ['module', 'main', 'types'],
      },
    ],
    ['entry', ['**/{LICENSE,README.md}', 'default.nix', 'biome.json']],
    'typescript',
    'javascript',
    'zombie'
  ],
};
