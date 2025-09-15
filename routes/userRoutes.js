const express = require('express');
const router = express.Router();
const { getUsers, getUserById, updateUser, toggleMfaStatus, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getUsers);
router.put('/:id/mfa-toggle', protect, toggleMfaStatus);
router.route('/:id').get(protect, getUserById).put(protect, updateUser).delete(protect, deleteUser);

module.exports = router;