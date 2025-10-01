const express = require('express');
const router = express.Router();
const {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    updateUserAvatar
} = require('../controllers/userController');

const { protect } = require('../middleware/authMiddleware');
const { superAdmin } = require('../middleware/superAdmin'); 

router.put('/me/avatar', protect, updateUserAvatar);

router.route('/')
    .get(protect, superAdmin, getUsers); 

router.route('/:id')
    .get(protect, superAdmin, getUserById) 
    .put(protect, updateUser) 
    .delete(protect, deleteUser); 

module.exports = router;