'use strict';

const fs = require('fs');
const fse = require('fs-extra');
const url = require('url');
const path = require('path');
const mkdirp = require('mkdirp-promise');
const readdirp = require('readdirp');
const request = require('request');
const rpn = require('request-promise-native');
const progress = require('request-progress');
const AdmZip = require('adm-zip');
const pretty = require('prettysize');
const packageJson = require('./package.json');

const openUI5DownloadHost = packageJson.openui5.downloadHost;
const oUI5VersionUrl = url.parse(`http://openui5.org/OpenUI5Downloads.json`);
const oUrl = url.parse(`http://${openUI5DownloadHost}/downloads/openui5-runtime-${packageJson.openui5.version}.zip`);

const downloadDir = path.resolve(`${__dirname}${path.dirname(oUrl.pathname)}`);
const outDir = path.resolve(`${__dirname}/lib`);
const outfile = path.resolve(`${__dirname}${oUrl.pathname}`);

function comp(a, b) {
    if (a.version < b.version) return -1;
    if (a.version > b.version) return 1;
    return 0;
}

function calcLatest(aData) {
    const bStable = packageJson.openui5.stable && packageJson.openui5.stable === 'true';

    const aRet = aData.filter(elem => {
        if (!bStable) {
            return elem.beta && elem.beta === 'true';
        } else {
            return !elem.beta;
        }
    });
    return aRet.sort(comp)[aRet.length - 1].version;
}

Promise.all([rpn.get(oUI5VersionUrl.href), fse.remove(outDir), fse.remove(downloadDir)])
    .then(data => {
        packageJson.openui5.version =
            packageJson.openui5.version === 'latest' ? calcLatest(JSON.parse(data[0])) : packageJson.openui5.version;
        const p1 = mkdirp(downloadDir);
        const p2 = mkdirp(outDir);
        return Promise.all([p1, p2]);
    })
    .then(values => {
        return new Promise((resolve, reject) => {
            console.log(`Downloading ${oUrl.href} into ${outDir}`);
            progress(request(oUrl.href))
                .on('progress', state => {
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
        const aRemoves = [];
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
        console.log('Try setting proxy (i.e. export HTTP_PROXY=http://proxy:8080)');
        console.log(err);
    });
