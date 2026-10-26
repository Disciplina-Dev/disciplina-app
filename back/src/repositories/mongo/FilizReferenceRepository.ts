import { getModels } from '../../db/mongo/tenant';
import { FilizClassRef, FilizDegreeRef } from '../../types/filizReference.types';

export class FilizReferenceRepository {
    async upsertDegrees(degrees: FilizDegreeRef[]): Promise<void> {
        if (degrees.length === 0) return;
        await getModels().FilizDegree.bulkWrite(
            degrees.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: d }, upsert: true } })),
        );
    }

    async upsertClasses(classes: FilizClassRef[]): Promise<void> {
        if (classes.length === 0) return;
        await getModels().FilizClass.bulkWrite(
            classes.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: c }, upsert: true } })),
        );
    }

    async findDegrees(): Promise<FilizDegreeRef[]> {
        return getModels().FilizDegree.find().sort({ title: 1 }).lean();
    }

    async findClassesByDegree(degreeId: string): Promise<FilizClassRef[]> {
        return getModels().FilizClass.find({ degree_id: degreeId }).sort({ name: 1 }).lean();
    }
}
