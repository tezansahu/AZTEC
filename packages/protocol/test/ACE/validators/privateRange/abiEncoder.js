/* global artifacts, expect, contract, beforeEach, it:true */
// ### External Dependencies
const { padLeft } = require('web3-utils');

// ### Internal Dependencies
const { constants } = require('@aztec/dev-utils');

const {
    proof: { privateRange },
    note,
    secp256k1,
    abiEncoder: { inputCoder, outputCoder },
} = require('aztec.js');

// ### Artifacts
const PrivateRange = artifacts.require('./PrivateRange');
const PrivateRangeInterface = artifacts.require('./PrivateRangeInterface');

PrivateRange.abi = PrivateRangeInterface.abi;

contract.only('PrivateRange', (accounts) => {
    let privateRangeContract;
    describe('Success States', () => {
        beforeEach(async () => {
            privateRangeContract = await PrivateRange.new({
                from: accounts[0],
            });
        });

        it('validate zk validator success', async () => {
            const noteValues = [10, 4, 6];
            const aztecAccounts = [...new Array(3)].map(() => secp256k1.generateAccount());
            const notes = [...aztecAccounts.map(({ publicKey }, i) => note.create(publicKey, noteValues[i]))];

            const originalNote = notes[0];
            const comparisonNote = notes[1];
            const utilityNote = notes[2];
            const senderAddress = accounts[0];

            const { proofData: proofDataRaw, challenge } = privateRange.constructProof(
                [originalNote, comparisonNote, utilityNote],
                senderAddress,
            );

            const inputNotes = [originalNote, comparisonNote];
            const outputNotes = [utilityNote];
            const inputOwners = inputNotes.map((m) => m.owner);
            const outputOwner = [utilityNote.owner];

            const proofData = inputCoder.privateRange(proofDataRaw, challenge, inputOwners, outputOwner, outputNotes);
            const publicOwner = constants.addresses.ZERO_ADDRESS;
            const publicValue = 0;

            const expectedOutput = outputCoder
                .encodeProofOutputs([
                    {
                        inputNotes,
                        outputNotes,
                        publicOwner,
                        publicValue,
                        challenge,
                    },
                ]);

            const opts = {
                from: accounts[0],
                gas: 4000000,
            };


            const result = await privateRangeContract.validatePrivateRange(proofData, accounts[0], constants.CRS, opts);
            const decoded = outputCoder.decodeProofOutputs(`0x${padLeft('0', 64)}${result.slice(2)}`);

            expect(decoded[0].outputNotes[0].gamma.eq(outputNotes[0].gamma)).to.equal(true);
            expect(decoded[0].outputNotes[0].sigma.eq(outputNotes[0].sigma)).to.equal(true);
            expect(decoded[0].outputNotes[0].noteHash).to.equal(outputNotes[0].noteHash);
            expect(decoded[0].outputNotes[0].owner).to.equal(outputNotes[0].owner.toLowerCase());
            expect(decoded[0].outputNotes[1]).to.equal(undefined);

            expect(decoded[0].inputNotes[0].gamma.eq(inputNotes[0].gamma)).to.equal(true);
            expect(decoded[0].inputNotes[0].sigma.eq(inputNotes[0].sigma)).to.equal(true);
            expect(decoded[0].inputNotes[0].noteHash).to.equal(inputNotes[0].noteHash);
            expect(decoded[0].inputNotes[0].owner).to.equal(inputNotes[0].owner.toLowerCase());

            expect(decoded[0].inputNotes[1].gamma.eq(inputNotes[1].gamma)).to.equal(true);
            expect(decoded[0].inputNotes[1].sigma.eq(inputNotes[1].sigma)).to.equal(true);
            expect(decoded[0].inputNotes[1].noteHash).to.equal(inputNotes[1].noteHash);
            expect(decoded[0].inputNotes[1].owner).to.equal(inputNotes[1].owner.toLowerCase());

            expect(decoded[0].publicOwner).to.equal(publicOwner.toLowerCase());
            expect(decoded[0].publicValue).to.equal(0);
            expect(result.slice(2)).to.equal(expectedOutput.slice(0x42));
            expect(result.slice(2).length / 2).to.equal(parseInt(expectedOutput.slice(0x02, 0x42), 16));
        });
    });
});
