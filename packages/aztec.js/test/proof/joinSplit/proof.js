const { constants } = require('@aztec/dev-utils');
const BN = require('bn.js');
const { expect } = require('chai');
const crypto = require('crypto');
const { padLeft } = require('web3-utils');

const bn128 = require('../../../src/bn128');
const proof = require('../../../src/proof/joinSplit');
const proofHelpers = require('../../../src/proof/joinSplit/helpers');

const { errorTypes } = constants;

const generateNoteValue = () => {
    return new BN(crypto.randomBytes(32), 16).umod(new BN(constants.K_MAX)).toNumber();
};

const getKPublic = (kIn, kOut) => {
    return kOut.reduce((acc, v) => acc - v, kIn.reduce((acc, v) => acc + v, 0));
};

const randomAddress = () => {
    return `0x${padLeft(crypto.randomBytes(20).toString('hex'), 64)}`;
};

const validateGroupElement = (xHex, yHex) => {
    const x = new BN(xHex.slice(2), 16);
    const y = new BN(yHex.slice(2), 16);
    expect(x.gt(new BN(0))).to.equal(true);
    expect(y.gt(new BN(0))).to.equal(true);
    expect(x.lt(bn128.curve.p)).to.equal(true);
    expect(y.lt(bn128.curve.p)).to.equal(true);
    const lhs = x
        .mul(x)
        .mul(x)
        .add(new BN(3));
    const rhs = y.mul(y);
    expect(lhs.umod(bn128.curve.p).eq(rhs.umod(bn128.curve.p))).that.equal(true);
};

const validateGroupScalar = (hex, canBeZero = false) => {
    const scalar = new BN(hex.slice(2), 16);
    expect(scalar.lt(bn128.curve.n)).to.equal(true);
    if (!canBeZero) {
        expect(scalar.gt(new BN(0))).to.equal(true);
    }
};

describe('Join-Split Proofs', () => {
    it('should construct a proof with well-formed outputs', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());

        const { commitments, m } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });
        const k = getKPublic(kIn, kOut);
        const kPublic = bn128.curve.n.add(new BN(k)).umod(bn128.curve.n);

        const { proofData, challenge } = proof.constructProof(commitments, m, randomAddress(), kPublic);

        expect(proofData.length).to.equal(5);
        expect(challenge.length).to.equal(66);
        validateGroupScalar(challenge);
        proofData.forEach((note, i) => {
            validateGroupScalar(note[0], i === proofData.length - 1);
            validateGroupScalar(note[1]);
            validateGroupElement(note[2], note[3]);
            validateGroupElement(note[4], note[5]);
        });
        expect(new BN(proofData[proofData.length - 1][0].slice(2), 16).eq(kPublic)).to.equal(true);
    });

    it('should fail to construct a proof with malformed kPublic', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());

        const { commitments, m } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });
        const kPublic = bn128.curve.n.add(new BN(100));

        try {
            proof.constructProof(commitments, m, randomAddress(), kPublic);
        } catch (err) {
            expect(err.message).to.equal(errorTypes.KPUBLIC_MALFORMED);
        }
    });

    it('should fail to construct a proof with m malformed', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());
        const kPublic = getKPublic(kIn, kOut);
        const { commitments } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });

        try {
            proof.constructProof(commitments, 500, randomAddress(), kPublic);
        } catch (err) {
            expect(err.message).to.equal(errorTypes.M_TOO_BIG);
        }
    });

    it('should fail to construct a proof if point NOT on curve', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());
        const kPublic = getKPublic(kIn, kOut);
        const { commitments } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });
        commitments[0].gamma.x = new BN(bn128.curve.p.add(new BN(100))).toRed(bn128.curve.red);
        try {
            proof.constructProof(commitments, 500, randomAddress(), kPublic);
        } catch (err) {
            expect(err.message).to.equal(errorTypes.NOT_ON_CURVE);
        }
    });

    it('should fail to construct a proof if point at infinity', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());
        const kPublic = getKPublic(kIn, kOut);
        const { commitments, m } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });
        commitments[0].gamma = commitments[0].gamma.add(commitments[0].gamma.neg());
        let message = '';
        try {
            proof.constructProof(commitments, m, randomAddress(), kPublic);
        } catch (err) {
            ({ message } = err);
        }
        expect(message).to.equal(errorTypes.POINT_AT_INFINITY);
    });

    it('should fail to construct a proof if viewing key response is 0', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());
        const kPublic = getKPublic(kIn, kOut);
        const { commitments, m } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });
        commitments[0].a = new BN(0).toRed(bn128.groupReduction);
        try {
            proof.constructProof(commitments, m, randomAddress(), kPublic);
        } catch (err) {
            expect(err.message).to.equal(errorTypes.VIEWING_KEY_MALFORMED);
        }
    });

    it('should fail to construct a proof if value > K_MAX', async () => {
        const kIn = [...Array(2)].map(() => generateNoteValue());
        const kOut = [...Array(3)].map(() => generateNoteValue());
        const kPublic = getKPublic(kIn, kOut);
        const { commitments, m } = await proofHelpers.generateFakeCommitmentSet({ kIn, kOut });
        commitments[0].k = new BN(constants.K_MAX + 1).toRed(bn128.groupReduction);
        try {
            proof.constructProof(commitments, m, randomAddress(), kPublic);
        } catch (err) {
            expect(err.message).to.equal(errorTypes.NOTE_VALUE_TOO_BIG);
        }
    });
});
