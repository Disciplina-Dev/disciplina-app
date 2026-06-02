"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateMysql = truncateMysql;
exports.dropMongo = dropMongo;
const connection_1 = __importDefault(require("../../src/db/mysql/connection"));
const candidate_schema_1 = require("../../src/db/mongo/schemas/candidate.schema");
const job_schema_1 = require("../../src/db/mongo/schemas/job.schema");
async function truncateMysql() {
    const conn = await connection_1.default.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE needs_analysis');
        await conn.query('TRUNCATE TABLE companies');
        await conn.query('TRUNCATE TABLE users');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    finally {
        conn.release();
    }
}
async function dropMongo() {
    await candidate_schema_1.CandidateModel.deleteMany({});
    await job_schema_1.JobModel.deleteMany({});
}
