const {series, watch, src, dest, parallel} = require('gulp');
const pump = require('pump');
const {mergeLocales} = require('@tryghost/theme-translations/build');

// gulp plugins and utils
const livereload = require('gulp-livereload');
const postcss = require('gulp-postcss');
const zip = require('gulp-zip').default;
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const beeper = require('beeper');

// postcss plugins
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const easyimport = require('postcss-easy-import');


function serve(done) {
    livereload.listen();
    done();
}

const handleError = (done) => {
    return function (err) {
        if (err) {
            beeper();
        }
        return done(err);
    };
};

function hbs(done) {
    pump([
        src(['*.hbs', 'partials/**/*.hbs']),
        livereload()
    ], handleError(done));
}

function css(done) {
    pump([
        src('assets/css/screen.css', {sourcemaps: true}),
        postcss([
            easyimport,
            autoprefixer(),
            cssnano()
        ]),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

// Languages highlighted in code blocks. Each one must come after the ones it requires
// (see node_modules/prismjs/components.json).
const PRISM_LANGUAGES = [
    'core',
    'markup', 'css', 'clike', 'javascript', 'markup-templating',
    'typescript', 'jsx', 'tsx', 'json', 'yaml', 'markdown', 'scss', 'handlebars',
    'bash', 'docker', 'nginx', 'ini', 'toml', 'diff', 'sql', 'graphql',
    'python', 'ruby', 'erb', 'php', 'go', 'rust', 'java', 'kotlin', 'c', 'cpp', 'csharp',
    'swift', 'lua', 'elixir'
];

function js(done) {
    pump([
        src([
            // Prism core + languages, in dependency order
            ...PRISM_LANGUAGES.map(lang => `node_modules/prismjs/components/prism-${lang}.js`),
            // pull in lib files first so our own code can depend on it
            'assets/js/lib/*.js',
            'assets/js/*.js'
        ], {sourcemaps: true}),
        concat('source.js'),
        uglify(),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

function zipper(done) {
    const filename = require('./package.json').name + '.zip';

    pump([
        src([
            '**',
            '!node_modules', '!node_modules/**',
            '!dist', '!dist/**',
            '!docs', '!docs/**',
            '!pnpm-debug.log',
            '!pnpm-lock.yaml',
            '!pnpm-workspace.yaml',
            '!AGENTS.md',
            '!CLAUDE.md',
            '!gulpfile.js'
        ]),
        zip(filename),
        dest('dist/')
    ], handleError(done));
}

const cssWatcher = () => watch('assets/css/**', css);
const jsWatcher = () => watch('assets/js/**', js);
const hbsWatcher = () => watch(['*.hbs', 'partials/**/*.hbs'], hbs);
const localesWatcher = () => watch('./locales-local/**/*.json', mergeLocales());
const watcher = parallel(cssWatcher, jsWatcher, hbsWatcher, localesWatcher);
const build = series(css, js, mergeLocales());

exports.build = build;
exports.zip = series(build, zipper);
exports.default = series(build, serve, watcher);
