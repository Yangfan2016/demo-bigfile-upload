import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";

function resolve(...args: string[]) {
    return path.resolve(process.env.PWD || '', ...args);
}

const dirpath = resolve('uploads')

createServer((req, res) => {
    const url = new URL(req.url || '', 'file:///');
    const { pathname } = url;
    switch (pathname) {
        case '/':
            fs.createReadStream(resolve('./index.html')).pipe(res);
            break;
        case '/upload':
            if (req.method === 'POST') {
                const f = Array.isArray(req.headers['x-file-name']) ? req.headers['x-file-name'][0] : req.headers['x-file-name']
                if (!f) return;
                const filename = decodeURIComponent(f);
                const filesize = Number(req.headers['x-file-size'] || '');
                const filetype = req.headers['x-file-type'];
                const total = Number(req.headers['x-file-total']);
                const cur = Number(req.headers['x-file-cur']);
                const filepath = resolve(dirpath, filename);
                const chunkpath = resolve(dirpath, `${filename}-${cur}`);

                if (!fs.existsSync(dirpath)) {
                    fs.mkdirSync(dirpath);
                }

                req.pipe(fs.createWriteStream(chunkpath, { flags: 'a' }))

                req.on('end', () => {
                    if (cur === total - 1) {
                        const chunks = new Array(total).fill(1).map((_, index) => resolve(dirpath, `${filename}-${index}`));
                        const writeStream = fs.createWriteStream(filepath);

                        function readChunk() {
                            const chunkpath = chunks.shift();
                            if (!chunkpath) {
                                writeStream.end();
                                console.log('all done')
                                res.end('all done');
                                return
                            }
                            const readStream = fs.createReadStream(chunkpath);
                            readStream.pipe(writeStream, {
                                // 禁止自动结束
                                end: false
                            });
                            readStream.on('end', () => {
                                // 删除
                                fs.unlink(chunkpath, err => {
                                    if (err) {
                                        console.log('delete chunk failed', chunkpath);
                                    }

                                    if (chunks.length) {
                                        readChunk()
                                    } else {
                                        writeStream.end();
                                        console.log('all done')
                                        res.end('all done');
                                    }
                                })
                            })
                        }
                        readChunk();

                    } else {
                        console.log('received chunk', chunkpath);
                        res.statusCode = 200;
                        res.end('ok')
                    }
                });
            } else {
                res.statusCode = 405;
                res.end(`The '/upload' not allowe not post method`);
            }
            break;
        default:
            res.statusCode = 404;
            res.end();
            break;
    }

}).listen(3000);