import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlternantModel } from '../../db/mongo/schemas/alternant.schema';
import { getModels } from '../../db/mongo/tenant';
import { FilizService } from '../../external/filiz/filiz.service';
import { FilizFolder } from '../../external/filiz/type';
import { FilizReferenceRepository } from '../../repositories/mongo/FilizReferenceRepository';
import { FilizSyncService } from '../FilizSyncService';

const PREFIX = 'filiz-sync-';

const DEGREE = {
    degreeId: `${PREFIX}degree-1`,
    degreeType: 'TP',
    exactDegreeTitle: 'Titre test',
    preparedTitleName: 'Prep test',
} as any;
const CLASS = {
    degreeId: `${PREFIX}degree-1`,
    classId: `${PREFIX}class-1`,
    className: 'Promo test',
    startDate: '2024-09-01',
    classStudyConfig: { contractType: { apprenticeshipContract: true, professionalizationContract: false } },
    headTeacher: { firstName: 'John', lastName: 'Smith', mailAddress: 'john@smith.fr' },
    realizationAddress: {
        housenumber: '12',
        street: 'RUE DU PARADIS',
        city: 'PARIS',
        postcode: '75012',
        country: 'FRANCE',
        formatted: '12 RUE DU PARADIS, 75012 PARIS, FRANCE',
        address_line1: 'x',
        address_line2: 'y',
    },
} as any;

const folder = (overrides: Partial<FilizFolder> = {}): FilizFolder => ({
    folderId: `${PREFIX}f1`,
    step: 3,
    updateDate: '2024-03-19T16:33:58.290Z',
    degreeId: 'degree-1',
    classId: 'class-1',
    studentId: 'student-1',
    ...overrides,
});

function mockFiliz(folders: FilizFolder[]) {
    vi.spyOn(FilizService.prototype, 'listFolderIds').mockResolvedValue(folders.map((f) => f.folderId));
    vi.spyOn(FilizService.prototype, 'getFolders').mockResolvedValue({ folders, failed: 0 });
    vi.spyOn(FilizService.prototype, 'getDegreesInfos').mockResolvedValue([DEGREE]);
    vi.spyOn(FilizService.prototype, 'getClassInfos').mockResolvedValue([CLASS]);
    return vi.spyOn(FilizService.prototype, 'getUser').mockResolvedValue({
        userId: 'student-1',
        firstName: 'John',
        lastName: 'Smith',
        mailAddress: 'john@smith.test',
    });
}

describe('FilizSyncService.syncAll', () => {
    beforeEach(async () => {
        await AlternantModel.deleteMany({ 'filiz.folder_id': { $regex: `^${PREFIX}` } });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await getModels().FilizDegree.deleteMany({ _id: { $regex: `^${PREFIX}` } });
        await getModels().FilizClass.deleteMany({ _id: { $regex: `^${PREFIX}` } });
        await AlternantModel.deleteMany({ 'filiz.folder_id': { $regex: `^${PREFIX}` } });
    });

    it('creates an alternant, without session, for a folder that matches no candidate', async () => {
        mockFiliz([folder()]);

        const result = await new FilizSyncService().syncAll();

        expect(result).toMatchObject({ total: 1, created: 1, updated: 0, skipped: 0, failed: 0 });
        const alternant = await AlternantModel.findOne({ 'filiz.folder_id': `${PREFIX}f1` }).lean();
        expect(alternant).toMatchObject({
            first_name: 'John',
            last_name: 'Smith',
            email: 'john@smith.test',
            session: '',
            session_id: null,
            candidate_id: null,
            company: null,
        });
        expect(alternant?.filiz).toMatchObject({ class_id: 'class-1', degree_id: 'degree-1', step: 3 });
    });

    it('is idempotent and refreshes the step without touching peda-edited fields or fetching the user again', async () => {
        const getUser = mockFiliz([folder()]);
        await new FilizSyncService().syncAll();
        await AlternantModel.updateOne(
            { 'filiz.folder_id': `${PREFIX}f1` },
            { $set: { first_name: 'Johnny', 'filiz.start_step': 1, 'filiz.company_siret': '22222222222207' } },
        );

        mockFiliz([folder({ step: 13 })]);
        const result = await new FilizSyncService().syncAll();

        expect(result).toMatchObject({ created: 0, updated: 1 });
        expect(await AlternantModel.countDocuments({ 'filiz.folder_id': `${PREFIX}f1` })).toBe(1);
        const alternant = await AlternantModel.findOne({ 'filiz.folder_id': `${PREFIX}f1` }).lean();
        expect(alternant?.first_name).toBe('Johnny');
        expect(alternant?.filiz).toMatchObject({ step: 13, start_step: 1, company_siret: '22222222222207' });
        expect(getUser).toHaveBeenCalledTimes(1);
    });

    it('skips a folder without class and counts an unknown student as failed', async () => {
        mockFiliz([folder({ folderId: `${PREFIX}no-class`, classId: undefined })]);
        expect(await new FilizSyncService().syncAll()).toMatchObject({ skipped: 1, created: 0 });

        mockFiliz([folder()]);
        vi.spyOn(FilizService.prototype, 'getUser').mockResolvedValue(null);
        expect(await new FilizSyncService().syncAll()).toMatchObject({ failed: 1, created: 0 });
    });

    it('upserts degrees and classes idempotently, and a reference failure does not block folders', async () => {
        mockFiliz([folder()]);
        const first = await new FilizSyncService().syncAll();
        const second = await new FilizSyncService().syncAll();
        expect(first).toMatchObject({ degrees: 1, classes: 1 });
        expect(second).toMatchObject({ degrees: 1, classes: 1 });
        const repo = new FilizReferenceRepository();
        expect((await repo.findClassesByDegree(DEGREE.degreeId)).map((c) => c.name)).toEqual(['Promo test']);
        const [cls] = await repo.findClassesByDegree(DEGREE.degreeId);
        expect(cls.head_teacher).toEqual({ first_name: 'John', last_name: 'Smith', mail_address: 'john@smith.fr' });
        expect(cls.referent_teacher).toBeNull();
        expect(cls.realization_address).toMatchObject({ city: 'PARIS', postcode: '75012' });
        expect(cls.realization_address).not.toHaveProperty('address_line1');
        expect((await repo.findDegrees()).filter((d) => d._id === DEGREE.degreeId)).toHaveLength(1);

        mockFiliz([folder()]);
        vi.spyOn(FilizService.prototype, 'getDegreesInfos').mockResolvedValue(null);
        expect(await new FilizSyncService().syncAll()).toMatchObject({ degrees: 0, classes: 0, updated: 1 });
    });

    it('returns null when Filiz cannot list folders', async () => {
        vi.spyOn(FilizService.prototype, 'listFolderIds').mockResolvedValue(null);
        expect(await new FilizSyncService().syncAll()).toBeNull();
    });
});
