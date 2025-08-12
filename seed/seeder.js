const mongoose = require('mongoose');
const dotenv = require('dotenv');
const users = require('./data/users');
const User = require('../models/User');
const Organization = require('../models/Organization');
const connectDB = require('../config/db');

dotenv.config({ path: '../.env' }); // Adjust path if necessary

connectDB();

const importData = async () => {
  try {
    await User.deleteMany();
    await Organization.deleteMany();

    const createdUsers = await User.insertMany(users);
    const adminUser = createdUsers[0];

    const sampleOrg = new Organization({
        name: 'Admin Corp',
        slug: 'admin-corp',
        members: [{ userId: adminUser._id, role: 'owner' }]
    });

    await sampleOrg.save();

    adminUser.organizations.push(sampleOrg._id);
    adminUser.currentOrganization = sampleOrg._id;
    await adminUser.save();


    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

const destroyData = async () => {
    try {
        await User.deleteMany();
        await Organization.deleteMany();
        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}