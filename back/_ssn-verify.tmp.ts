import mongoose from 'mongoose';
import { decryptSsn, isEncryptedSsn } from './src/external/crypto/ssn-cipher';

(async () => {
    await mongoose.connect('mongodb://mongo-user:mongo-secret-pw@localhost:27017/ssn_migration_test?authSource=admin');
    const doc = await mongoose.connection.collection('candidates').findOne({ _id: 'legacy-cand-1' as never });
    const ssn = doc!.identity.social_security_number;
    console.log('isEncryptedSsn:', isEncryptedSsn(ssn));
    console.log('decrypted:', decryptSsn(ssn));
    const triplets = await mongoose.connection.collection('candidates').countDocuments({
        'identity.social_security_number.encrypted': { $type: 'string' },
    });
    console.log('encrypted docs:', triplets);
    await mongoose.disconnect();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});