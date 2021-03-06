/* global, beforeEach, it:true */
const { expect } = require('chai');
const web3Utils = require('web3-utils');

const dividendComputation = require('../../../src/proof/dividendComputation');
const proofUtils = require('../../../src/proof/proofUtils');

describe('Dividend Computation Proof', () => {
    it('should construct a proof with well-formed outputs', async () => {
        /*
        Test case:
        - k_in = 90
        - Interest rate = 5%
        - k_out = 4
        - k_res = 5
        - za = 5
        - zb = 100
        */

        const testNotes = await proofUtils.makeTestNotes([90], [4, 50]);
        const za = 100;
        const zb = 5;

        const sender = web3Utils.randomHex(20);
        const { proofDataUnformatted, proofData, challenge } = dividendComputation.constructProof(testNotes, za, zb, sender);
        const numProofDataElements = 18;

        expect(proofDataUnformatted.length).to.equal(3);
        expect(proofData.length).to.equal(numProofDataElements);
        expect(challenge.length).to.equal(66);
        expect(proofDataUnformatted[0].length).to.equal(6);
        expect(proofDataUnformatted[1].length).to.equal(6);
        expect(proofDataUnformatted[2].length).to.equal(6);
    });
});
