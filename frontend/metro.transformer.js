const upstream = require('@expo/metro-config/babel-transformer');

// File .geojson diperlakukan seperti JSON.
module.exports.transform = ({ src, filename, options }) =>
  upstream.transform({
    src: filename.endsWith('.geojson') ? `module.exports = ${src};` : src,
    filename,
    options,
  });
