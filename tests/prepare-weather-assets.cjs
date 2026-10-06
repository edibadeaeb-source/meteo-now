/* Lossless source originals remain in their generation folder. Optimize delivery only. */
const fs = require('fs'), path = require('path');
const sharp = require('C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
async function main() {
  const sources = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/,''));
  const target = path.join(__dirname, '..', 'assets', 'weather', 'v1');
  fs.mkdirSync(target, {recursive:true});
  for (const {name, path:source} of sources) {
    const file = path.join(target, name + '.webp');
    await sharp(source).resize({width:1080, withoutEnlargement:true}).webp({quality:84, effort:5}).toFile(file);
    const meta = await sharp(file).metadata();
    console.log(JSON.stringify({name,width:meta.width,height:meta.height,bytes:fs.statSync(file).size}));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
