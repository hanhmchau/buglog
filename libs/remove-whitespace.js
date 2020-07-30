/** https://github.com/stevenvachon/normalize-html-whitespace */

"use strict";
const pattern = /[\f\n\r\t\v ]{2,}/g;
const replacement = " ";

const normalize = str => str.replace(pattern, replacement);

export default normalize;