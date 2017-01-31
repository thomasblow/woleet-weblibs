'use strict';

/**
 * @typedef {Object}   AnchorIDsPage
 * @typedef {String[]} Page.content array of anchorID
 * @typedef {Number}   Page.totalPages number of pages with the current size
 * @typedef {Number}   Page.totalElements number of elements matching the request
 * @typedef {Boolean}  Page.last boolean that indicates if the current page is the last one
 * @typedef {Boolean}  Page.sort boolean that indicates if the current page is the last one
 * @typedef {Boolean}  Page.first boolean that indicates if the current page is the first one
 * @typedef {Number}   Page.numberOfElements number of elements matching the request on the current page
 * @typedef {Number}   Page.size current page size
 * @typedef {Number}   Page.number current number (starting at 0)
 */

;(function (root, factory) {
    root.woleet = factory(root.woleet);
})(window, function (woleet) {

    function RequestError(req) {
        this.name = 'getJSON';
        this.message = req.statusText && req.statusText.length ? req.statusText : 'Error wile getting data';
        this.code = req.status;
        //noinspection JSUnusedGlobalSymbols
        this.body = req.response;
        this.stack = new Error().stack;
    }
    RequestError.prototype = Object.create(Error.prototype);
    //noinspection JSUnusedGlobalSymbols
    RequestError.prototype.constructor = RequestError;

    function getJSON(url) {
        var req = new XMLHttpRequest();

        return new Promise(function (resolve, reject) {

            req.onload = function () {

                switch (req.status) {
                    case 200:
                    case 201:
                        typeof req.response == "string" ? resolve(JSON.parse(req.response)) : resolve(req.response); // ie
                        break;
                    case 404:
                        resolve(null);
                        break;
                    default:
                        reject(new RequestError(req));
                        break;
                }
            };

            req.onerror = function () {
                reject(new RequestError(req));
            };

            req.open("GET", url, true);
            req.responseType = "json";
            req.json = "json";
            req.send();
        });
    }

    /**
     * @param {String} tx_id
     * @param {Number} confirmations
     * @param {Date} confirmed_at
     * @param {String} block_hash
     * @param {String} op_return
     */
    function makeTransaction(tx_id, confirmations, confirmed_at, block_hash, op_return) {

        if (confirmed_at.toString() == "Invalid Date") confirmed_at = null;

        return {
            tx_id: tx_id,
            confirmations: confirmations,
            confirmedAt: confirmed_at,
            blockHash: block_hash,
            opReturn: op_return
        };
    }

    var woleetAPI = "https://api.woleet.io/v1";
    var api = woleet || {};
    api.receipt = api.receipt || {};
    api.anchor = api.anchor || {};

    api.transaction = function () {
        var default_api = 'blockcypher.com';

        return {
            setDefaultProvider: function setDefaultProvider(api) {
                switch (api) {
                    case 'blockcypher.com':
                        default_api = api;
                        break;
                    case 'woleet.io':
                        default_api = api;
                        break;
                    case 'chain.so':
                    default:
                        default_api = 'chain.so';
                        break;
                }
            },
            /**
             * @param tx_id
             * @returns {Promise.<Transaction>}
             */
            get: function get(tx_id) {
                switch (default_api) {
                    case 'woleet.io':
                        return getJSON(woleetAPI + '/bitcoin/transaction/' + tx_id).then(function (res) {
                            if (!res || res.status != 200) {
                                throw new Error('tx_not_found');
                            } else {
                                //noinspection JSUnresolvedVariable
                                return makeTransaction(res.data.txid, res.data.confirmations, new Date(res.data.time * 1000), res.data.blockhash || 0, function (outputs) {
                                    var opr_return_found = null;
                                    outputs.forEach(function (output) {
                                        if (output.hasOwnProperty('scriptPubKey')) {
                                            //noinspection JSUnresolvedVariable
                                            if (output.scriptPubKey.hasOwnProperty('asm')) {
                                                //noinspection JSUnresolvedVariable
                                                if (output.scriptPubKey.asm.indexOf('OP_RETURN') != -1) {
                                                    //noinspection JSUnresolvedVariable
                                                    opr_return_found = output.scriptPubKey.asm.split(' ')[1];
                                                }
                                            }
                                        }
                                        if (opr_return_found) return true; //breaks foreach
                                    });
                                    return opr_return_found;
                                }(res.data.vout || []));
                            }
                        });
                    case 'chain.so':
                        return getJSON('https://chain.so/api/v2/get_tx/BTC/' + tx_id).then(function (res) {
                            if (!res || res.status == 'fail') {
                                throw new Error('tx_not_found');
                            } else {
                                //noinspection JSUnresolvedVariable
                                return makeTransaction(res.data.txid, res.data.confirmations, new Date(res.data.time * 1000), res.data.blockhash, function (outputs) {
                                    var opr_return_found = null;
                                    outputs.forEach(function (output) {
                                        if (output.hasOwnProperty('script')) {
                                            //noinspection JSUnresolvedVariable
                                            if (output.script.indexOf('OP_RETURN') != -1) {
                                                //noinspection JSUnresolvedVariable
                                                opr_return_found = output.script.split(' ')[1];
                                            }
                                            if (opr_return_found) return true; //breaks foreach
                                        }
                                    });
                                    return opr_return_found;
                                }(res.data.outputs || []));
                            }
                        });
                    case 'blockcypher.com':
                        return getJSON('https://api.blockcypher.com/v1/btc/main/txs/' + tx_id).then(function (res) {
                            if (!res || res.error) {
                                throw new Error('tx_not_found');
                            } else {
                                //noinspection JSUnresolvedVariable
                                return makeTransaction(res.hash, res.confirmations, new Date(res.confirmed), res.block_hash, function (outputs) {
                                    var opr_return_found = null;
                                    outputs.forEach(function (output) {
                                        if (output.hasOwnProperty('data_hex')) {
                                            //noinspection JSUnresolvedVariable
                                            opr_return_found = output.data_hex;
                                        }
                                        if (opr_return_found) return true; //breaks foreach
                                    });
                                    return opr_return_found;
                                }(res.outputs || []));
                            }
                        });
                }
            }
        };
    }();

    /**
     * @param {String} hash
     * @param {Number} [size]
     * @returns {Promise<AnchorIDsPage>}
     */
    api.anchor.getAnchorIDs = function (hash, size) {
        size = size || 20;
        return getJSON(woleetAPI + "/anchorids?size=" + size + "&hash=" + hash);
    };

    /**
     * @param {String} anchorId
     * @returns {Promise<Receipt>}
     */
    api.receipt.get = function (anchorId) {
        return getJSON(woleetAPI + "/receipt/" + anchorId).then(function (res) {
            if (!res) {
                throw new Error('not_found');
            } else {
                return res;
            }
        });
    };

    /**
     * @param {Hash} hash
     * @returns {boolean}
     */
    api.isSHA256 = function (hash) {
        var sha256RegExp = /^[A-Fa-f0-9]{64}$/;
        return sha256RegExp.test(hash);
    };

    return api;
});
'use strict';

/**
 * @typedef {Object}   Leaf
 * @typedef {Hash}     Leaf.left
 * @typedef {Hash}     Leaf.right
 * @typedef {Hash}     Leaf.parent
 */

/**
 * @typedef {Object}   Receipt
 * @typedef {Object}   Receipt.header
 * @typedef {String}   Receipt.header.chainpoint_version
 * @typedef {String}   Receipt.header.hash_type
 * @typedef {String}   Receipt.header.merkle_root
 * @typedef {String}   Receipt.header.tx_id
 * @typedef {String}   Receipt.header.timestamp
 * @typedef {Object}   Receipt.target
 * @typedef {String}   Receipt.target.target_hash
 * @typedef {String}   Receipt.target.target_URI
 * @typedef {Leaf[]}   Receipt.target.target_proof
 * @typedef {Object[]} Receipt.extra
 */

;(function (root, factory) {
    root.woleet = factory(root.woleet);
})(window, function (woleet) {

    /**
     * @typedef {String} Hash
     * @typedef {function(String): Hash} HashFunction
     */

    /**
     * @type HashFunction
     * @param {String} content
     * @returns {Hash}
     */

    var sha256 = function () {

        /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
        /* SHA-256 (FIPS 180-4) implementation in JavaScript                  (c) Chris Veness 2002-2016  */
        /*                                                                                   MIT Licence  */
        /* www.movable-type.co.uk/scripts/sha256.html                                                     */
        /*                                                                                                */
        /*  - see http://csrc.nist.gov/groups/ST/toolkit/secure_hashing.html                              */
        /*        http://csrc.nist.gov/groups/ST/toolkit/examples.html                                    */
        /* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

        'use strict';

        function R(n, x) {
            //noinspection JSConstructorReturnsPrimitive
            return x >>> n | x << 32 - n;
        }

        function F0(x) {
            //noinspection JSConstructorReturnsPrimitive
            return R(2, x) ^ R(13, x) ^ R(22, x);
        }

        function F1(x) {
            //noinspection JSConstructorReturnsPrimitive
            return R(6, x) ^ R(11, x) ^ R(25, x);
        }

        function S0(x) {
            //noinspection JSConstructorReturnsPrimitive
            return R(7, x) ^ R(18, x) ^ x >>> 3;
        }

        function S1(x) {
            //noinspection JSConstructorReturnsPrimitive
            return R(17, x) ^ R(19, x) ^ x >>> 10;
        }

        function Ch(x, y, z) {
            //noinspection JSConstructorReturnsPrimitive
            return x & y ^ ~x & z;
        }

        function Maj(x, y, z) {
            //noinspection JSConstructorReturnsPrimitive
            return x & y ^ x & z ^ y & z;
        }

        return function (msg) {
            var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

            var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

            msg += String.fromCharCode(0x80);
            var l = msg.length / 4 + 2;
            var N = Math.ceil(l / 16);
            var M = new Array(N);

            for (var i = 0; i < N; i++) {
                M[i] = new Array(16);
                for (var j = 0; j < 16; j++) {
                    M[i][j] = msg.charCodeAt(i * 64 + j * 4) << 24 | msg.charCodeAt(i * 64 + j * 4 + 1) << 16 | msg.charCodeAt(i * 64 + j * 4 + 2) << 8 | msg.charCodeAt(i * 64 + j * 4 + 3);
                }
            }
            var lenHi = (msg.length - 1) * 8 / Math.pow(2, 32);
            var lenLo = (msg.length - 1) * 8 >>> 0;
            M[N - 1][14] = Math.floor(lenHi);
            M[N - 1][15] = lenLo;

            for (var _i = 0; _i < N; _i++) {
                var W = new Array(64);

                for (var t = 0; t < 16; t++) {
                    W[t] = M[_i][t];
                }for (var _t = 16; _t < 64; _t++) {
                    W[_t] = S1(W[_t - 2]) + W[_t - 7] + S0(W[_t - 15]) + W[_t - 16] >>> 0;
                }

                var a = H[0],
                    b = H[1],
                    c = H[2],
                    d = H[3],
                    e = H[4],
                    f = H[5],
                    g = H[6],
                    _h = H[7];

                for (var _t2 = 0; _t2 < 64; _t2++) {
                    var T1 = _h + F1(e) + Ch(e, f, g) + K[_t2] + W[_t2];
                    var T2 = F0(a) + Maj(a, b, c);
                    _h = g;
                    g = f;
                    f = e;
                    e = d + T1 >>> 0;
                    d = c;
                    c = b;
                    b = a;
                    a = T1 + T2 >>> 0;
                }

                H[0] = H[0] + a >>> 0;
                H[1] = H[1] + b >>> 0;
                H[2] = H[2] + c >>> 0;
                H[3] = H[3] + d >>> 0;
                H[4] = H[4] + e >>> 0;
                H[5] = H[5] + f >>> 0;
                H[6] = H[6] + g >>> 0;
                H[7] = H[7] + _h >>> 0;
            }

            for (var h = 0; h < H.length; h++) {
                H[h] = ('00000000' + H[h].toString(16)).slice(-8);
            }return H.join('');
        };
    }();

    /**
     * Build a Merkle branch.
     * @param {Hash} left
     * @param {Hash} right
     * @param {HashFunction} [hash_f]
     * @constructor
     */
    function MerkleBranch(left, right, hash_f) {
        /**
         * @type {function(String): Hash}
         */
        var _hash_f = hash_f || sha256;
        /***
         * @type {Hash}
         */
        var _left = left;
        /**
         * @type {Hash}
         */
        var _right = right;
        /**
         * @type {Hash}
         */
        var _parent = _hash_f(_left + _right);

        /**
         * Get the parent of the branch.
         * @returns {Hash}
         */
        this.get_parent = function () {
            return _parent;
        };

        /**
         * Check if a branch contains a hash.
         * @param {Hash} target
         * @returns {boolean}
         */
        this.contains = function (target) {
            return _left == target || _right == target;
        };

        /**
         * @returns {{parent: Hash, left: Hash, right: Hash}}
         */
        this.get_json = function () {
            return {
                "parent": _parent,
                "left": _left,
                "right": _right
            };
        };
    }

    /**
     * Builds a Merkle proof.
     * @param {String} target
     * @param {Function} [hash_f]
     * @constructor
     */
    function MerkleProof(target, hash_f) {
        var self = this;

        //noinspection JSUnusedGlobalSymbols
        this.hash_f = hash_f || sha256;
        this.branches = [];
        this.target = target;

        /**
         * Add a branch to the proof.
         * @param {MerkleBranch} branch
         */
        this.add = function (branch) {
            self.branches.push(branch);
        };

        /**
         * Returns the root string if proof is valid, false if it's not
         * @returns {String|Boolean}
         */
        this.is_valid = function () {
            // Check if the target hash is in the proof.

            // We assume that the leaf is contained in the
            // first branch of the proof, so then we check
            // if the parent is contained in each higher
            // branch.

            var new_target = self.target;

            if (!self.branches.length) return false;

            for (var i = 0, branch; i < self.branches.length; i++) {
                branch = self.branches[i];
                if (!branch.contains(new_target)) {
                    return false;
                }
                new_target = branch.get_parent();
            }

            return new_target;
        };

        // MerkleProof to machine readable JSON.
        this.get_json = function () {
            var json_data = [];
            self.branches.forEach(function (branch) {
                json_data.push(branch.get_json());
            });
            return json_data;
        };
    }

    var api = woleet || {};
    api.receipt = api.receipt || {};

    /**
     * Validate a receipt.
     * @param {Receipt} receipt
     * @returns {Boolean} true if the receipt is valid
     */
    api.receipt.validate = function (receipt) {

        if (!receipt || !receipt.target || !receipt.target.target_hash || !receipt.target.target_proof || !(receipt.target.target_proof instanceof Array) || !receipt.header || !receipt.header.hash_type || !receipt.header.merkle_root || !receipt.header.tx_id) {
            throw new Error("invalid_receipt_format");
        }

        for (var i = 0; i < receipt.target.target_proof.length; i++) {
            var branch = receipt.target.target_proof[i];
            if (!branch.left || !branch.right || !branch.parent) {
                throw new Error("invalid_target_proof");
            }
            if (!api.isSHA256(branch.left) || !api.isSHA256(branch.right) || !api.isSHA256(branch.parent)) {
                throw new Error("non_sha256_target_proof_element");
            }
        }

        // If no Merkle proof
        if (receipt.target.target_proof.length == 0) {
            // Receipt is valid if target hash is Merkle root
            if (receipt.target.target_hash == receipt.header.merkle_root) return true;else throw new Error("merkle_root_mismatch");
        }

        // If there is a Merkle proof
        else {

                // Build the Merkle proof while checking its integrity
                var proof = new MerkleProof(receipt.target.target_hash);
                receipt.target.target_proof.forEach(function (branch) {

                    // Build a new Merkle branch
                    var merkleBranch = new MerkleBranch(branch.left, branch.right);

                    // Check that provided parent is correctly computed
                    if (!merkleBranch.get_parent() == branch.parent) {
                        throw new Error("invalid_parent_in_proof_element");
                    }

                    // Add Merkle branch to the Merkle proof
                    proof.add(merkleBranch);
                });

                // Receipt is valid if Merkle proof root is  Merkle root
                if (proof.is_valid() == receipt.header.merkle_root) return true;else throw new Error("merkle_root_mismatch");
            }
    };

    return api;
});
"use strict";

;(function (root, factory) {
    root.woleet = factory(root.woleet);
})(window, function (woleet) {

    var api = woleet || {};
    api.receipt = api.receipt || {};
    api.anchor = api.anchor || {};
    api.verify = api.verify || {};

    /**
     * @param {File|String} file
     * @returns {Promise.<Object[]>}
     */
    api.verify.WoleetDAB = function (file) {

        return hashStringOrFile(file)

        // we get the hash, so now we get the corresponding anchor ids
        .then(function (hash) {
            return api.anchor.getAnchorIDs(hash);
        })
        // we got ids (an array), for each of them, we get the corresponding receipts
        .then(function (anchorIDsPage) {
            var receiptArray = [];
            return anchorIDsPage.content.reduce(function (chain, anchorId) {
                return chain.then(function () {
                    return api.receipt.get(anchorId).then(function (receipt) {
                        return receiptArray.push(receipt);
                    }, function (error) {
                        // if we cannot get the corresponding receipt for
                        // this anchorID because it's not yet processed (202)
                        // we ignore this element, else we forward error
                        if (error.code != 202) throw error;
                    });
                });
            }, Promise.resolve())

            // we got a receipt array, so we forward it
            .then(function () {
                // if we had a match but can't get a receipt
                if (!receiptArray.length && anchorIDsPage.content.length) {
                    throw new Error('file_matched_but_anchor_not_yet_processed');
                }

                return receiptArray;
            });
        }).then(function (receiptArray) {

            // we check each receipt we got
            var receiptsCheckOk = receiptArray.map(function (receipt) {
                try {
                    return api.receipt.validate(receipt);
                } catch (err) {
                    return false;
                }
            });

            // we check that all of them are correct
            var receiptsOk = receiptsCheckOk.every(function (e) {
                return e == true;
            });

            var finalArray = [];

            // if so, we get the corresponding transaction
            if (receiptsOk) {
                return receiptArray.reduce(function (chain, receipt) {
                    return chain.then(function () {
                        return api.transaction.get(receipt.header.tx_id).then(function (tx) {
                            finalArray.push({
                                receipt: receipt,
                                confirmations: tx.confirmations,
                                date: tx.confirmedAt
                            });
                        });
                    });
                }, Promise.resolve())

                // we got a array of object with the {receipt, transactionDate}, so we forward it
                .then(function () {
                    return finalArray;
                });
            } else {
                throw new Error("invalid_receipt");
            }
        });
    };

    /**
     * @param {File|String} file
     * @param {Receipt} receipt
     * @returns {Promise<Object>}
     */
    api.verify.DAB = function (file, receipt) {

        return hashStringOrFile(file).then(function (hash) {

            api.receipt.validate(receipt);

            if (receipt.target.target_hash != hash) throw new Error("target_hash_mismatch");

            return api.transaction.get(receipt.header.tx_id).then(function (tx) {
                return tx;
            }, function (error) {
                if (error.message == 'tx_not_found') {
                    throw error;
                } else {
                    throw new Error("error_while_getting_transaction");
                }
            });
        }).then(function (tx) {

            if (tx.opReturn == receipt.header.merkle_root) return {
                receipt: receipt,
                confirmations: tx.confirmations,
                date: tx.confirmedAt
            }; // opReturn matches root
            else throw new Error('opReturn_mismatches_merkleRoot');
        });
    };

    var hashStringOrFile = function hashStringOrFile(file) {
        var resolveHash;
        var rejectHash;
        var hashPromise = new Promise(function (resolve, reject) {
            resolveHash = resolve;
            rejectHash = reject;
        });

        if (file instanceof File) {

            if (!api.file || !api.file.Hasher) throw new Error("missing_woleet_hash_dependency");

            var hasher = new api.file.Hasher();
            //noinspection JSUnusedLocalSymbols
            hasher.on('result', function (message, file) {
                resolveHash(message.result);
            });

            hasher.on('error', function (error) {
                rejectHash(error);
            });

            hasher.start(file);
        } else if (typeof file == "string") {
            if (api.isSHA256(file)) {
                //noinspection JSUnusedAssignment
                resolveHash(file);
            } else {
                //noinspection JSUnusedAssignment
                rejectHash(new Error("parameter_string_not_a_sha256_hash"));
            }
        } else {
            //noinspection JSUnusedAssignment
            rejectHash(new Error("invalid_parameter"));
        }

        return hashPromise;
    };

    return api;
});
"use strict";

/**
 * @typedef {Object}   ProgressMessage
 * @typedef {Number}   ProgressMessage.progress (float number)
 * @typedef {File}     ProgressMessage.file
 */

/**
 * @typedef {Object}   StartMessage
 * @typedef {Boolean}  StartMessage.start always true
 * @typedef {File}     ProgressMessage.file
 */

/**
 * @typedef {Object}   ErrorMessage
 * @typedef {Error}    ErrorMessage.error
 * @typedef {File}     EndMessage.file
 */

/**
 * @typedef {Object}   EndMessage
 * @typedef {String}   EndMessage.end hash of the file
 * @typedef {File}     EndMessage.file
 */

;(function (root, factory) {
    root.woleet = factory(root.woleet);
})(window, function (woleet) {

    /**
     * @returns the base path (including final '/') of the current scripts.
     */
    function findBasePath() {
        var scripts = document.getElementsByTagName('script'),
            script = scripts[scripts.length - 1].src,
            // last script is alwyas the current script
        basePath = script.substr(0, script.lastIndexOf("/") + 1);
        return basePath;
    }

    // Guess the path of the worker script (NOTE: you can defined woleet.workerScriptPath to overwrite this path)
    var basePath = findBasePath();
    var DEFAUlT_WORKER_SCRIPT = "worker.min.js";
    var workerScriptPath = woleet.workerScriptPath || (basePath ? basePath + DEFAUlT_WORKER_SCRIPT : null);
    console.log("worker script:", workerScriptPath);
    if (!workerScriptPath) throw new Error('Cannot find ' + DEFAUlT_WORKER_SCRIPT);

    /**
     * Check support for workers.
     */
    function checkFileReaderSyncSupport() {

        function makeWorker(script) {
            //noinspection JSUnresolvedVariable
            var URL = window.URL || window.webkitURL;
            var Blob = window.Blob;
            var Worker = window.Worker;

            if (!URL || !Blob || !Worker || !script) return null;

            var blob = new Blob([script]);
            //noinspection JSUnresolvedFunction
            return new Worker(URL.createObjectURL(blob));
        }

        return new Promise(function (resolve) {
            var syncDetectionScript = "onmessage = function(e) { postMessage(!!FileReaderSync); };";
            try {
                var worker = makeWorker(syncDetectionScript);
                if (worker) {
                    worker.onmessage = function (e) {
                        resolve(e.data);
                    };
                    worker.postMessage({});
                } else resolve(false);
            } catch (err) {
                resolve(false);
            }
        });
    }

    var testFileReaderSupport = checkFileReaderSyncSupport();

    var api = woleet || {};
    api.file = api.file || {};

    api.file.Hasher = function () {

        var ready = true;
        var cb_start, cb_progress, cb_result, cb_error;

        /**
         * @param {String} event
         * @param {Function} callback
         */
        this.on = function (event, callback) {
            switch (event) {
                case 'start':
                    cb_start = callback;
                    break;
                case 'progress':
                    cb_progress = callback;
                    break;
                case 'error':
                    cb_error = callback;
                    break;
                case 'result':
                    cb_result = callback;
                    break;
                default:
                    throw new Error('Invalid event name "' + event + '"');
            }
        };

        /**
         * @param {FileList|File} files
         * @param {Number} len
         */
        var hashWorker = function hashWorker(files, len) {
            var i = 0;
            var worker = new Worker(workerScriptPath);

            worker.onmessage = function (message) {
                //handling worker message
                if (message.data.progress != undefined) {
                    if (cb_progress) cb_progress(message.data);
                } else if (message.data.result) {
                    if (cb_result) cb_result(message.data);
                    next();
                } else if (message.data.start) {
                    if (cb_start) cb_start(message.data);
                } else if (message.data.error) {
                    var error = message.data.error;
                    if (cb_error) cb_error(error);else throw error;
                } else {
                    console.trace("Unexpected worker message :", message);
                }
            };

            function next() {
                if (i >= len) {
                    worker.terminate();
                    ready = true;
                } else {
                    worker.postMessage(files.item(i));
                    i++;
                }
            }

            //entry point
            if (len != -1) next(); // if files is a list
            else {
                    worker.postMessage(files);
                }
        };

        /**
         * @param {FileList|File} files
         * @param {Number} len
         */
        var hashLocal = function hashLocal(files, len) {
            var i = 0;

            /**
             * @param {File} file
             */
            function hash(file) {
                var err = new Error("file_too_big_to_be_hashed_without_worker");
                if (file.size > 5e7) {
                    ready = true;
                    if (cb_error) return cb_error({ error: err, file: file });else throw err;
                }
                if (cb_start) cb_start({ start: true, file: file });

                var reader = new FileReader();

                var sha256 = CryptoJS.algo.SHA256.create();
                var hash,
                    prev = 0;

                reader.onloadend = function () {
                    hash.finalize();
                    if (cb_result) cb_result({
                        result: hash._hash.toString(CryptoJS.enc.Hex),
                        file: file
                    });
                    next();
                };

                reader.onprogress = function (e) {
                    //noinspection JSUnresolvedVariable
                    /** @type ArrayBuffer */
                    var buf = e.target.result;
                    //noinspection JSUnresolvedVariable
                    var blob = buf.slice(prev, e.loaded);
                    var chunkUint8 = new Uint8Array(blob);
                    var wordArr = CryptoJS.lib.WordArray.create(chunkUint8);
                    hash = sha256.update(wordArr);
                    //noinspection JSUnresolvedVariable
                    prev = e.loaded;
                    if (cb_progress) {
                        //noinspection JSUnresolvedVariable
                        cb_progress({ progress: e.loaded / e.total, file: file });
                    }
                };

                reader.readAsArrayBuffer(file);
            }

            function next() {
                if (i >= len) {
                    ready = true;
                } else {
                    hash(files.item(i));
                    i++;
                }
            }

            //entry point
            if (len != -1) next(); // if files is a list
            else {
                    hash(files);
                }
        };

        this.start = function (files) {

            if (!ready) throw new Error("not_ready");

            var len = -1;

            if (files instanceof FileList) {
                len = files.length;
            } else if (files instanceof File) {} else throw new Error("invalid_parameter");

            ready = false;

            testFileReaderSupport.then(function (supported) {
                if (supported) {
                    hashWorker(files, len);
                } else if (typeof CryptoJS !== 'undefined') {
                    hashLocal(files, len);
                } else {
                    throw new Error("no_viable_hash_method");
                }
            });
        };

        this.isReady = function () {
            return ready;
        };
    };

    return api;
});