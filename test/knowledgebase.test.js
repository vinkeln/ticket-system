import { expect } from 'chai';
import sinon from 'sinon';
import * as knowledgeBaseModule from '../src/knowledgeBase.js'; // Importera rätt modul
import db from '../src/db.js'; // Mocka databas

describe('createArticle', () => {
    let queryStub;

    beforeEach(() => {
        queryStub = sinon.stub(db, 'query');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should create an article', async () => {
        queryStub.resolves([{}]);

        await knowledgeBaseModule.createArticle('Test Article', 'Test Content', 1);
        expect(queryStub.calledOnce).to.be.true;
    });
});

describe('getArticles', () => {
    let queryStub;

    beforeEach(() => {
        queryStub = sinon.stub(db, 'query');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return articles based on search', async () => {
        const mockArticles = [{ id: 1, title: 'Test Article' }];
        queryStub.resolves([mockArticles]);

        const result = await knowledgeBaseModule.getArticles('Test');
        expect(result).to.deep.equal(mockArticles);
        expect(queryStub.calledOnce).to.be.true;
    });
});
