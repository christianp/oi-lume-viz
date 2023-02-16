import * as path from 'std/path/mod.ts';
import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import oiComponents from '../mod.ts';
import { stringify as yamlStringify } from 'std/encoding/yaml.ts';

// Code highlighting
import code_highlight from "lume/plugins/code_highlight.ts";
// import your favorite language(s)
import lang_javascript from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/javascript.min.js";
import lang_json from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/json.min.js";
import lang_powershell from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/powershell.min.js";
import lang_bash from "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/es/languages/bash.min.js";

import autoDependency from 'https://cdn.jsdelivr.net/gh/open-innovations/oi-lume-utils@0.2.0-pre/processors/auto-dependency.ts';

import nunjucks from "lume/deps/nunjucks.ts";

const site = lume({
  location: new URL("https://open-innovations.github.io/oi-lume-charts/"),
  src: '.',
});



site.loadAssets([".css"]);

// TODO(@giles) Make this work in all the places!
site.use(oiComponents({
  assetPath: '/assets',
  componentNamespace: 'oi',
}));
site.use(basePath());
site.process(['.html'], autoDependency);

console.log(path.resolve('README.md'));
site.remoteFile('index.md', path.resolve('README.md'));

// Map test data to local site
site.remoteFile('samples/chart/bar/_data/examples.yml', './test/data/bar-chart.yml');

// Add filters
site.filter('yaml', (value, options = {}) => yamlStringify(value, options));
site.filter('match', (value, regex) => { const re = new RegExp(regex); return value.match(re); });



site.use(
  code_highlight({
    languages: {
      javascript: lang_javascript,
      json: lang_json,
	  powershell: lang_powershell,
	  bash: lang_bash,
    },
	options: {
		classPrefix: 'oi-'
	}
  })
);


export default site;
