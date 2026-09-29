/* Vercel entry point: every request that is not a static file in public/ is
 * rewritten here (see vercel.json) and handled by the Express app. */
module.exports = require('../server');
