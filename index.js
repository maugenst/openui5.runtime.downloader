'use_strict';

const fs = require('fs');
const fse = require('fs-extra');
const url = require('url');
const path = require('path');
const mkdirp = require('mkdirp-promise');
const readdirp = require('readdirp');
const request = require('request');
const progress = require('request-progress');
const AdmZip = require('adm-zip');
const pretty = require('prettysize');
const packageJson = require('./package.json');
const isReachable = require('is-reachable');

let openUI5DownloadHost = packageJson.openui5.downloadHost;
let oUrl = url.parse(`http://${openUI5DownloadHost}/downloads/openui5-runtime-${packageJson.openui5.version}.zip`);

let downloadDir = path.resolve(__dirname + path.dirname(oUrl.pathname));
let outDir = path.resolve(`${__dirname}/lib`);
let outfile = path.resolve(__dirname + oUrl.pathname);

Promise.all([fse.remove(outDir), fse.remove(downloadDir)])
    .then(() => {
        const p1 = mkdirp(downloadDir);
        const p2 = mkdirp(outDir);
        const p3 = isReachable(openUI5DownloadHost);
        return Promise.all([p1, p2, p3]);
    })
    .then(values => {
        const reachable = values[2];
        if (!reachable) {
            throw new Error('OpenUI5 download host not reachable. Try setting proxy (i.e. export HTTP_PROXY=http://proxy:8080)');
        }
        return new Promise((resolve, reject) => {
            console.log(`Downloading ${oUrl.href} into ${outDir}`);
            progress(request(oUrl.href))
                .on('progress', state => {
                    let percent = Math.round(state.percent * 100, 10);
                    console.log(
                        `Downloaded: ${Math.round(state.percent * 100, 10)}% [${pretty(
                            state.size.transferred
                        )} / ${pretty(state.size.total)}]`
                    );
                })
                .on('error', err => {
                    reject(err);
                })
                .on('end', () => {
                    resolve();
                })
                .pipe(fs.createWriteStream(outfile));
        });
    })
    .then(() => {
        console.log(`Starting extraction of '${outfile}' into '${outDir}'...`);
        return new Promise((resolve, reject) => {
            var zip = new AdmZip(outfile);
            zip.extractAllTo(outDir, true);
            resolve();
        });
    })
    .then(() => {
        console.log('Cleanup: removing dbg files');
        let i = 0;
        let delSize = 0;
        let aRemoves = [];
        return new Promise((resolve, reject) => {
            readdirp({root: outDir, fileFilter: '*-dbg.js'})
                .on('data', function(entry) {
                    aRemoves.push(fse.remove(entry.fullPath));
                    i++;
                    delSize += entry.stat.size;
                })
                .on('error', err => {
                    reject(err);
                })
                .on('end', () => {
                    Promise.all(aRemoves).then(() => {
                        console.log(`Cleanup: ${i} files removed. Saved ${pretty(delSize)}.`);
                        resolve();
                    });
                });
        });
    })
    .then(() => {
        console.log('Cleanup: removing downloads');
        return fse.remove(downloadDir);
    })
    .catch(function(err) {
        console.log(err);
    });
