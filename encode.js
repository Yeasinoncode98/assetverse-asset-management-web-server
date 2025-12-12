const fs = require("fs");
const key = fs.readFileSync("./assetverse.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);
// Added to encode and turn the sdk as Base 64"
