const { DigiLockerMock } = require('../models/DigiLockerModels');

const MOCK_RECORDS = [
  {
    name: 'John Doe',
    aadhaar: '123456789012',
    pan: 'ABCDE1234F',
    dob: '1990-05-15',
    gender: 'Male',
    address: '12, MG Road, Bengaluru, Karnataka - 560001',
    certificates: [
      { type: 'Driving Licence', number: 'KA0120190012345', issuer: 'RTO Bengaluru', issuedOn: '2019-03-10' },
      { type: 'Voter ID', number: 'XYZ1234567', issuer: 'Election Commission of India', issuedOn: '2010-01-01' },
    ],
  },
  {
    name: 'Priya Sharma',
    aadhaar: '234567890123',
    pan: 'FGHIJ5678K',
    dob: '1985-11-22',
    gender: 'Female',
    address: '45, Nehru Place, New Delhi - 110019',
    certificates: [
      { type: 'Passport', number: 'P1234567', issuer: 'Ministry of External Affairs', issuedOn: '2018-07-20' },
    ],
  },
  {
    name: 'Ravi Kumar',
    aadhaar: '345678901234',
    pan: 'KLMNO9012P',
    dob: '1978-03-08',
    gender: 'Male',
    address: '78, Anna Salai, Chennai, Tamil Nadu - 600002',
    certificates: [
      { type: 'Driving Licence', number: 'TN0120150067890', issuer: 'RTO Chennai', issuedOn: '2015-06-15' },
      { type: 'Birth Certificate', number: 'BC/TN/1978/00456', issuer: 'Municipal Corporation Chennai', issuedOn: '1978-04-01' },
    ],
  },
  {
    name: 'Anita Patel',
    aadhaar: '456789012345',
    pan: 'PQRST3456U',
    dob: '1995-08-30',
    gender: 'Female',
    address: '23, CG Road, Ahmedabad, Gujarat - 380009',
    certificates: [],
  },
  {
    name: 'Mohammed Ali',
    aadhaar: '567890123456',
    pan: 'UVWXY7890Z',
    dob: '1982-12-01',
    gender: 'Male',
    address: '56, Banjara Hills, Hyderabad, Telangana - 500034',
    certificates: [
      { type: 'Voter ID', number: 'ABC9876543', issuer: 'Election Commission of India', issuedOn: '2004-01-01' },
    ],
  },
];

async function seedMockData() {
  try {
    const count = await DigiLockerMock.count();
    if (count > 0) { console.log(`Mock data already seeded (${count} records)`); return; }
    await DigiLockerMock.bulkCreate(MOCK_RECORDS);
    console.log(`Seeded ${MOCK_RECORDS.length} mock DigiLocker records`);
  } catch (err) {
    console.error('Mock seed error:', err.message);
    // Retry once with individual creates to surface per-record errors
    try {
      for (const r of MOCK_RECORDS) {
        await DigiLockerMock.findOrCreate({ where: { aadhaar: r.aadhaar }, defaults: r });
      }
      console.log('Mock data seeded via findOrCreate fallback');
    } catch (e2) {
      console.error('Mock seed fallback error:', e2.message);
    }
  }
}

module.exports = { seedMockData };
