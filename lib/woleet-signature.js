;(function (factory) {
    const root = typeof window !== 'undefined' ? window : {woleet: {}};
    return module.exports = factory(root.woleet, root);
})(function (woleet = {}) {

    const messagePrefix = '\x18Bitcoin Signed Message:\n';//require('../node_modules/bitcoinjs-lib/src/networks').bitcoin.messagePrefix;

    const verify = require('bitcoinjs-message').verify;

    function randomString(len) {
        let l = 0;
        const a = [];
        while (l++ < len) a.push(Math.floor(Math.random() * 0xff));
        return (new Buffer(a)).toString('hex')
    }

    function validateIdentity(identityUrl, pubKey) {
        const rand = randomString(16);
        return woleet.identity.getRandomSignature(identityUrl, pubKey, rand)
            .then((res) => {
                if (!res.rightData || !res.signature)
                    throw new Error('bad_server_response');

                return validateSignature(rand + res.rightData, pubKey, res.signature)
            })
    }

    function validateSignature(message, address, signature) {
        return Promise.resolve((() => {
            try {
                return {valid: verify(message, messagePrefix, address, signature)};
            } catch (err) {
                return {
                    valid: false,
                    reason: err.message
                }
            }
        })())
    }

    return woleet.signature = {validateSignature, validateIdentity, Buffer};
});