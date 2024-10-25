import { expect } from 'chai';
import sinon from 'sinon';
import { getStatuses } from '../src/status.js'; // Importera rätt modul från status.js
import db from '../src/db.js'; // Mocka databas

describe('getStatuses', () => {
    let queryStub;

    beforeEach(() => {
        queryStub = sinon.stub(db, 'query');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return all statuses', async () => {
        const mockStatuses = [{ id: 1, name: 'Open' }];
        queryStub.resolves([mockStatuses]);

        const result = await getStatuses();
        expect(result).to.deep.equal(mockStatuses);
        expect(queryStub.calledOnce).to.be.true;
    });
});
