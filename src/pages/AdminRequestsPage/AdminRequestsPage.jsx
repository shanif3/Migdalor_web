import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    Tabs,
    Tab,
    Menu,
    MenuItem,
    Alert,
    Snackbar,
    CircularProgress,
    Divider
} from '@mui/material';
import { motion } from 'framer-motion';
import {
    Check,
    X,
    Clock,
    Search,
    MoreVertical,
    UserCheck,
    Shield,
    AlertCircle,
    Trash2,
    Edit2,
    Save
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { supabase } from 'lib/supabaseClient';

export default function AdminRequests() {
    const { user, isDark } = useOutletContext();
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTab, setCurrentTab] = useState(0);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [battalions, setBattalions] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [teams, setTeams] = useState([]);

    const [roles, setRoles] = useState([]);
    const [userRolesMap, setUserRolesMap] = useState({});
    const [editRolesDialogOpen, setEditRolesDialogOpen] = useState(false);
    const [selectedUserForRoles, setSelectedUserForRoles] = useState(null);
    const [selectedRoles, setSelectedRoles] = useState([]);

    const [currentUserHierarchy, setCurrentUserHierarchy] = useState(null);
    const [viewMode, setViewMode] = useState('all');

    const isAdmin = user?.roles?.includes('מנהל');
    const isStaff = user?.roles?.includes('סגל');
    const hasAccess = isAdmin || isStaff;

    useEffect(() => {
        if (user) {
            console.log('User roles:', user.roles);
        }
        if (!user) return;
        if (!hasAccess) {
            navigate('/Home');
            return;
        }
        fetchRequests();
        fetchGroupNodes();
        fetchRoles();
    }, [user, hasAccess, navigate]);

    useEffect(() => {
        if (!editDialogOpen) return;
        if (!editForm?.battalion_id) {
            setEditForm((prev) => ({ ...prev, company_id: '', team_id: '' }));
            return;
        }
        const companyValid = companies.some(
            (c) => c.id === editForm.company_id && c.parent_id === editForm.battalion_id
        );
        if (!companyValid) {
            setEditForm((prev) => ({ ...prev, company_id: '', team_id: '' }));
        }
    }, [editForm.battalion_id, editDialogOpen, companies]);

    useEffect(() => {
        if (!editDialogOpen) return;
        if (!editForm?.company_id) {
            setEditForm((prev) => ({ ...prev, team_id: '' }));
            return;
        }
        const teamValid = teams.some(
            (t) => t.id === editForm.team_id && t.parent_id === editForm.company_id
        );
        if (!teamValid) {
            setEditForm((prev) => ({ ...prev, team_id: '' }));
        }
    }, [editForm.company_id, editDialogOpen, teams]);

    const fetchRoles = async () => {
        try {
            const { data: rolesData } = await supabase.from('roles').select('*').order('id');
            setRoles(rolesData || []);
            const { data: userRolesData } = await supabase.from('user_roles').select('user_id, role_id');
            const rolesMap = {};
            userRolesData?.forEach(ur => {
                if (!rolesMap[ur.user_id]) rolesMap[ur.user_id] = [];
                rolesMap[ur.user_id].push(ur.role_id);
            });
            setUserRolesMap(rolesMap);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const getRoleNames = (userId) => {
        const roleIds = userRolesMap[userId] || [];
        return roleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean);
    };

    const fetchGroupNodes = async () => {
        const { data: nodesData } = await supabase.from('group_node').select('id, name, group_type_id, parent_id').order('name');
        if (!nodesData) return;
        const normalized = nodesData.map(n => ({ ...n, id: String(n.id), parent_id: n.parent_id == null ? null : String(n.parent_id) }));
        setBattalions(normalized.filter(n => n.group_type_id === 2));
        setCompanies(normalized.filter(n => n.group_type_id === 3));
        setTeams(normalized.filter(n => n.group_type_id === 4));
    };

    const rtlFieldSx = {
        '& .MuiInputBase-root': { borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' },
        '& .MuiInputBase-input': { textAlign: 'right' },
        '& .MuiInputLabel-root': { right: 14, left: 'auto', transformOrigin: 'top right', textAlign: 'right', padding: '0 4px', backgroundColor: isDark ? '#1a1a1a' : '#fff', zIndex: 1 },
        '& .MuiInputLabel-shrink': { transform: 'translate(0, -9px) scale(0.75)', right: 14 },
        '& .MuiOutlinedInput-notchedOutline': { textAlign: 'right', '& legend': { textAlign: 'right', width: 'auto' } }
    };

    const resolveHierarchyFromTeam = (teamId) => {
        if (!teamId) return { battalion_id: '', company_id: '', team_id: '' };
        const all = [...battalions, ...companies, ...teams];
        const map = Object.fromEntries(all.map(n => [n.id, n]));
        const team = map[String(teamId)];
        if (!team) return { battalion_id: '', company_id: '', team_id: String(teamId) };
        const company = team.parent_id ? map[team.parent_id] : null;
        const battalion = company?.parent_id ? map[company.parent_id] : null;
        return { team_id: team.id, company_id: company?.id || '', battalion_id: battalion?.id || '' };
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const { data: usersData, error: usersError } = await supabase.from('users').select('*').order('created_date', { ascending: false });
            if (usersError) { setSnackbar({ open: true, message: 'שגיאה בטעינת נתונים', severity: 'error' }); setLoading(false); return; }
            const { data: allNodes } = await supabase.from('group_node').select('id, name, group_type_id, parent_id');
            const nodesMap = {};
            if (allNodes) allNodes.forEach(node => { nodesMap[node.id] = node; });

            const getHierarchy = (groupId) => {
                const result = { team_id: null, team_name: null, company_id: null, company_name: null, battalion_id: null, battalion_name: null };
                if (!groupId || !nodesMap[groupId]) return result;
                let currentNode = nodesMap[groupId];
                const path = [];
                while (currentNode) { path.push(currentNode); if (currentNode.parent_id && nodesMap[currentNode.parent_id]) currentNode = nodesMap[currentNode.parent_id]; else break; }
                path.forEach(node => {
                    if (node.group_type_id === 4) { result.team_id = node.id; result.team_name = node.name.replace(/^צוות\s+/g, '').trim(); }
                    else if (node.group_type_id === 3) { result.company_id = node.id; result.company_name = node.name; }
                    else if (node.group_type_id === 2) { result.battalion_id = node.id; result.battalion_name = node.name; }
                });
                return result;
            };

            const transformedData = (usersData || []).map(user => ({ ...user, ...getHierarchy(user.group_id) }));
            const currentUserData = transformedData.find(u => u.email === authUser?.email);
            if (currentUserData) {
                setCurrentUserHierarchy({ battalion_id: currentUserData.battalion_id, battalion_name: currentUserData.battalion_name, company_id: currentUserData.company_id, company_name: currentUserData.company_name, team_id: currentUserData.team_id, team_name: currentUserData.team_name });
            }
            setRequests(transformedData);
            setFilteredRequests(transformedData);
        } catch (err) { setSnackbar({ open: true, message: 'שגיאה בטעינת נתונים', severity: 'error' }); }
        setLoading(false);
    };

    useEffect(() => {
        let filtered = requests;
        if (currentTab === 0) filtered = filtered.filter(req => req.status === 'pending');
        else if (currentTab === 1) filtered = filtered.filter(req => req.status === 'approved');
        else if (currentTab === 2) filtered = filtered.filter(req => req.status === 'rejected');
        if (searchTerm) filtered = filtered.filter(req => req.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || req.email?.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!isAdmin || viewMode === 'myGroup') {
            if (currentUserHierarchy) {
                filtered = filtered.filter(req => {
                    if (currentUserHierarchy.team_id) return req.team_id === currentUserHierarchy.team_id;
                    else if (currentUserHierarchy.company_id) return req.company_id === currentUserHierarchy.company_id;
                    else if (currentUserHierarchy.battalion_id) return req.battalion_id === currentUserHierarchy.battalion_id;
                    return true;
                });
            }
        }
        setFilteredRequests(filtered);
    }, [currentTab, searchTerm, requests, isAdmin, viewMode, currentUserHierarchy]);

    const handleApprove = async (requestId) => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { error } = await supabase.from('users').update({ status: 'approved', reviewed_by: currentUser?.id, updated_date: new Date().toISOString() }).eq('id', requestId);
        if (!error) { setSnackbar({ open: true, message: 'הבקשה אושרה בהצלחה!', severity: 'success' }); await fetchRequests(); setDialogOpen(false); }
        else setSnackbar({ open: true, message: 'שגיאה באישור הבקשה', severity: 'error' });
    };

    const handleReject = async (requestId, reason = '') => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { error } = await supabase.from('users').update({ status: 'rejected', rejection_reason: reason || null, reviewed_by: currentUser?.id, updated_date: new Date().toISOString() }).eq('id', requestId);
        if (!error) { setSnackbar({ open: true, message: 'הבקשה נדחתה', severity: 'info' }); await fetchRequests(); setDialogOpen(false); setRejectDialogOpen(false); }
        else setSnackbar({ open: true, message: 'שגיאה בדחיית הבקשה', severity: 'error' });
    };

    const handleDeleteUser = async () => {
        if (!selectedRequest) return;
        await supabase.from('user_roles').delete().eq('user_id', selectedRequest.id);
        const { error } = await supabase.from('users').delete().eq('id', selectedRequest.id);
        if (!error) { setSnackbar({ open: true, message: 'המשתמש נמחק בהצלחה', severity: 'success' }); await fetchRequests(); await fetchRoles(); setDeleteDialogOpen(false); }
        else setSnackbar({ open: true, message: 'שגיאה במחיקת המשתמש', severity: 'error' });
    };

    const handleMenuClick = (event, request) => { setAnchorEl(event.currentTarget); setSelectedRequest(request); };
    const handleMenuClose = () => setAnchorEl(null);
    const openDialog = (request) => { setSelectedRequest(request); setDialogOpen(true); handleMenuClose(); };
    const openRejectDialog = (request) => { setSelectedRequest(request); setRejectionReason(''); setRejectDialogOpen(true); handleMenuClose(); };
    const openDeleteDialog = (request) => { setSelectedRequest(request); setDeleteDialogOpen(true); handleMenuClose(); };
    const openEditDialog = (request) => { setSelectedRequest(request); const { battalion_id, company_id, team_id } = resolveHierarchyFromTeam(request.group_id); setEditForm({ full_name: request.full_name || '', phone: request.phone || '', battalion_id, company_id, team_id }); setEditDialogOpen(true); handleMenuClose(); };
    const openEditRolesDialog = (request) => { setSelectedUserForRoles(request); setSelectedRoles(userRolesMap[request.id] || []); setEditRolesDialogOpen(true); handleMenuClose(); };
    const handleRoleToggle = (roleId) => { setSelectedRoles(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]); };

    const handleSaveUserRoles = async () => {
        if (!selectedUserForRoles) return;
        try {
            await supabase.from('user_roles').delete().eq('user_id', selectedUserForRoles.id);
            if (selectedRoles.length > 0) {
                const inserts = selectedRoles.map(roleId => ({ user_id: selectedUserForRoles.id, role_id: roleId, assigned_date: new Date().toISOString() }));
                const { error } = await supabase.from('user_roles').insert(inserts);
                if (error) throw error;
            }
            setUserRolesMap(prev => ({ ...prev, [selectedUserForRoles.id]: selectedRoles }));
            setSnackbar({ open: true, message: 'התפקידים עודכנו בהצלחה', severity: 'success' });
            setEditRolesDialogOpen(false);
        } catch (error) { setSnackbar({ open: true, message: 'שגיאה בשמירת התפקידים', severity: 'error' }); }
    };

    const handleEditSave = async () => {
        if (!selectedRequest) return;
        if (!editForm.full_name?.trim()) { setSnackbar({ open: true, message: 'שם מלא הוא שדה חובה', severity: 'error' }); return; }
        const { error } = await supabase.from('users').update({ full_name: editForm.full_name, phone: editForm.phone || null, group_id: editForm.team_id || null, updated_date: new Date().toISOString() }).eq('id', selectedRequest.id);
        if (!error) { setSnackbar({ open: true, message: 'הפרטים עודכנו בהצלחה!', severity: 'success' }); await fetchRequests(); setEditDialogOpen(false); }
        else setSnackbar({ open: true, message: 'שגיאה בעדכון הפרטים', severity: 'error' });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return { bg: 'rgba(251, 191, 36, 0.1)', color: '#f59e0b', label: 'ממתין' };
            case 'approved': return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', label: 'אושר' };
            case 'rejected': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'נדחה' };
            default: return { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', label: 'לא ידוע' };
        }
    };

    const formatPhoneDisplay = (phone) => { if (!phone) return ''; const cleaned = phone.replace(/[^0-9]/g, ''); return cleaned.length <= 3 ? cleaned : `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`; };

    if (!user) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>;
    if (!hasAccess) return <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}><Shield size={64} color="#ef4444" /><Typography variant="h5" sx={{ mt: 2, fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>אין הרשאת גישה</Typography></Container>;

    const cellStyle = { color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', textAlign: 'center' };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }} dir="rtl">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <UserCheck size={32} style={{ color: '#6366f1' }} />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>ניהול בקשות</Typography>
                    </Box>
                    <Typography sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b' }}>ניהול בקשות הרשמה למערכת</Typography>
                </Box>
            </motion.div>

            <Card sx={{ mb: 3, bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', borderRadius: '16px' }}>
                <CardContent>
                    <TextField placeholder="חיפוש לפי שם או אימייל..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} fullWidth InputProps={{ startAdornment: <Search size={20} style={{ marginLeft: 8, color: '#64748b' }} /> }} sx={{ ...rtlFieldSx, '& .MuiOutlinedInput-root': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc' } }} />
                </CardContent>
            </Card>

            <Card sx={{ mb: 3, bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', borderRadius: '16px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2 }}>
                    <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} sx={{ '& .MuiTabs-indicator': { bgcolor: '#6366f1' } }}>
                        <Tab icon={<Clock size={18} />} iconPosition="start" label="ממתין" />
                        <Tab icon={<Check size={18} />} iconPosition="start" label="אושר" />
                        <Tab icon={<X size={18} />} iconPosition="start" label="נדחה" />
                        <Tab icon={<Shield size={18} />} iconPosition="start" label="הכל" />
                    </Tabs>
                    {isAdmin && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip label="כל המשתמשים" onClick={() => setViewMode('all')} sx={{ cursor: 'pointer', fontWeight: 500, bgcolor: viewMode === 'all' ? 'rgba(99, 102, 241, 0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'), color: viewMode === 'all' ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'), border: viewMode === 'all' ? '2px solid #6366f1' : '2px solid transparent' }} />
                            <Chip label={currentUserHierarchy?.team_name ? `צוות ${currentUserHierarchy.team_name}` : currentUserHierarchy?.company_name || 'השיוך שלי'} onClick={() => setViewMode('myGroup')} sx={{ cursor: 'pointer', fontWeight: 500, bgcolor: viewMode === 'myGroup' ? 'rgba(16, 185, 129, 0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'), color: viewMode === 'myGroup' ? '#10b981' : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'), border: viewMode === 'myGroup' ? '2px solid #10b981' : '2px solid transparent' }} />
                        </Box>
                    )}
                    {!isAdmin && currentUserHierarchy && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b', fontSize: '0.85rem' }}>מציג:</Typography>
                            <Chip label={currentUserHierarchy?.team_name ? `צוות ${currentUserHierarchy.team_name}` : currentUserHierarchy?.company_name || 'השיוך שלי'} size="small" sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 500 }} />
                        </Box>
                    )}
                </Box>
            </Card>

            <Card sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', borderRadius: '16px' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={cellStyle}>תאריך</TableCell>
                                <TableCell sx={cellStyle}>שם משתמש</TableCell>
                                <TableCell sx={cellStyle}>אימייל</TableCell>
                                <TableCell sx={cellStyle}>טלפון</TableCell>
                                <TableCell sx={cellStyle}>תפקיד</TableCell>
                                <TableCell sx={cellStyle}>גדוד</TableCell>
                                <TableCell sx={cellStyle}>פלוגה</TableCell>
                                <TableCell sx={cellStyle}>צוות</TableCell>
                                {currentTab === 3 && <TableCell sx={cellStyle}>סטטוס</TableCell>}
                                <TableCell sx={cellStyle}>פעולות</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (<TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                            ) : filteredRequests.length === 0 ? (<TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, ...cellStyle }}>אין בקשות להצגה</TableCell></TableRow>
                            ) : (filteredRequests.map((request) => {
                                const roleNames = getRoleNames(request.id);
                                return (
                                    <TableRow key={request.id}>
                                        <TableCell sx={cellStyle}>{request.created_date ? new Date(request.created_date).toLocaleDateString('he-IL') : '-'}</TableCell>
                                        <TableCell sx={cellStyle}><Typography sx={{ fontWeight: 600 }}>{request.full_name || 'לא ידוע'}</Typography></TableCell>
                                        <TableCell sx={cellStyle}>{request.email}</TableCell>
                                        <TableCell sx={cellStyle}>{request.phone || '-'}</TableCell>
                                        <TableCell sx={cellStyle}>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                                {roleNames.length > 0 ? roleNames.map((name, idx) => (<Chip key={idx} label={name} size="small" sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontWeight: 500 }} />)) : (<Chip label="ללא" size="small" sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }} />)}
                                                <IconButton size="small" onClick={() => openEditRolesDialog(request)} sx={{ color: '#6366f1', ml: 0.5 }}><Edit2 size={14} /></IconButton>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={cellStyle}>{request.battalion_name || '-'}</TableCell>
                                        <TableCell sx={cellStyle}>{request.company_name || '-'}</TableCell>
                                        <TableCell sx={cellStyle}>{request.team_name || '-'}</TableCell>
                                        {currentTab === 3 && (<TableCell sx={cellStyle}><Chip label={getStatusColor(request.status).label} size="small" sx={{ bgcolor: getStatusColor(request.status).bg, color: getStatusColor(request.status).color }} /></TableCell>)}
                                        <TableCell sx={cellStyle}>
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                {request.status === 'pending' && (<><IconButton onClick={() => handleApprove(request.id)} sx={{ color: '#10b981' }}><Check size={20} /></IconButton><IconButton onClick={() => openRejectDialog(request)} sx={{ color: '#ef4444' }}><X size={20} /></IconButton></>)}
                                                <IconButton onClick={(e) => handleMenuClick(e, request)} sx={{ color: isDark ? 'white' : '#1e293b' }}><MoreVertical size={20} /></IconButton>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            }))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} PaperProps={{ dir: 'rtl', sx: { minWidth: 180, borderRadius: 2 } }}>
                <MenuItem onClick={() => openDialog(selectedRequest)}><AlertCircle size={18} style={{ marginLeft: 12 }} /><Typography>צפייה בפרטים</Typography></MenuItem>
                <MenuItem onClick={() => openEditDialog(selectedRequest)}><Edit2 size={18} style={{ marginLeft: 12 }} /><Typography>עריכת פרטים</Typography></MenuItem>
                <MenuItem onClick={() => openEditRolesDialog(selectedRequest)}><Shield size={18} style={{ marginLeft: 12 }} /><Typography>עריכת תפקידים</Typography></MenuItem>
                <MenuItem onClick={() => openDeleteDialog(selectedRequest)} sx={{ color: '#ef4444' }}><Trash2 size={18} style={{ marginLeft: 12 }} /><Typography>מחיקת משתמש</Typography></MenuItem>
                {selectedRequest?.status === 'pending' && (<><Divider sx={{ my: 1 }} /><MenuItem onClick={() => handleApprove(selectedRequest?.id)} sx={{ color: '#10b981' }}><Check size={18} style={{ marginLeft: 12 }} /><Typography>אישור בקשה</Typography></MenuItem><MenuItem onClick={() => openRejectDialog(selectedRequest)} sx={{ color: '#ef4444' }}><X size={18} style={{ marginLeft: 12 }} /><Typography>דחיית בקשה</Typography></MenuItem></>)}
            </Menu>

            <Dialog open={editRolesDialogOpen} onClose={() => setEditRolesDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ dir: 'rtl', sx: { borderRadius: 3, bgcolor: isDark ? '#1e1e2e' : 'white' } }}>
                <DialogTitle sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>עריכת תפקידים - {selectedUserForRoles?.full_name}</DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 2, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>בחר את התפקידים עבור משתמש זה:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {roles.map((role) => { const isSelected = selectedRoles.includes(role.id); return (<Chip key={role.id} label={role.name} onClick={() => handleRoleToggle(role.id)} sx={{ cursor: 'pointer', fontWeight: 500, bgcolor: isSelected ? 'rgba(99, 102, 241, 0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'), color: isSelected ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'), border: isSelected ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.2s' }} />); })}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={() => setEditRolesDialogOpen(false)} sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b' }}>ביטול</Button><Button onClick={handleSaveUserRoles} variant="contained" startIcon={<Save size={18} />} sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}>שמור שינויים</Button></DialogActions>
            </Dialog>

            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ dir: 'rtl', sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}><AlertCircle color="#ef4444" style={{ marginLeft: 8 }} /> מחיקת משתמש</DialogTitle>
                <DialogContent><Typography>האם אתה בטוח שברצונך למחוק את <strong>{selectedRequest?.full_name}</strong>?</Typography><Typography variant="body2" sx={{ mt: 1, color: '#ef4444' }}>פעולה זו תמחק את המשתמש לצמיתות מהמערכת.</Typography></DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setDeleteDialogOpen(false)}>ביטול</Button><Button onClick={handleDeleteUser} variant="contained" color="error">מחק משתמש</Button></DialogActions>
            </Dialog>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ dir: 'rtl', sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>פרטי בקשה</DialogTitle>
                <DialogContent>{selectedRequest && (<Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 2, pt: 2 }}><Typography fontWeight={600} color="text.secondary">שם מלא:</Typography><Typography>{selectedRequest.full_name}</Typography><Typography fontWeight={600} color="text.secondary">אימייל:</Typography><Typography sx={{ direction: 'ltr', textAlign: 'right' }}>{selectedRequest.email}</Typography><Typography fontWeight={600} color="text.secondary">טלפון:</Typography><Typography>{formatPhoneDisplay(selectedRequest.phone) || '-'}</Typography><Typography fontWeight={600} color="text.secondary">תפקיד:</Typography><Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{getRoleNames(selectedRequest.id).length > 0 ? getRoleNames(selectedRequest.id).map((name, idx) => (<Chip key={idx} label={name} size="small" sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }} />)) : <Typography>-</Typography>}</Box><Typography fontWeight={600} color="text.secondary">שיוך:</Typography><Typography>{`${selectedRequest.battalion_name || '-'} / ${selectedRequest.company_name || '-'} / ${selectedRequest.team_name || '-'}`}</Typography></Box>)}</DialogContent>
                <DialogActions><Button onClick={() => setDialogOpen(false)}>סגור</Button></DialogActions>
            </Dialog>

            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ dir: 'rtl', sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>עריכת פרטים</DialogTitle>
                <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField label="שם מלא" value={editForm.full_name || ''} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} fullWidth sx={rtlFieldSx} InputLabelProps={{ shrink: true }} />
                    <TextField label="טלפון" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} fullWidth sx={rtlFieldSx} InputLabelProps={{ shrink: true }} />
                    <TextField select label="גדוד" value={editForm.battalion_id || ''} onChange={(e) => setEditForm({ ...editForm, battalion_id: e.target.value, company_id: '', team_id: '' })} SelectProps={{ native: true }} fullWidth sx={rtlFieldSx} InputLabelProps={{ shrink: true }}><option value="" disabled></option>{battalions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</TextField>
                    <TextField select label="פלוגה" value={editForm.company_id || ''} onChange={(e) => setEditForm({ ...editForm, company_id: e.target.value, team_id: '' })} SelectProps={{ native: true }} fullWidth disabled={!editForm.battalion_id} sx={rtlFieldSx} InputLabelProps={{ shrink: true }}><option value="" disabled></option>{companies.filter(c => c.parent_id === editForm.battalion_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</TextField>
                    <TextField select label="צוות" value={editForm.team_id || ''} onChange={(e) => setEditForm({ ...editForm, team_id: e.target.value })} SelectProps={{ native: true }} fullWidth disabled={!editForm.company_id} sx={rtlFieldSx} InputLabelProps={{ shrink: true }}><option value="" disabled></option>{teams.filter(t => t.parent_id === editForm.company_id).map(t => <option key={t.id} value={t.id}>{t.name.replace(/^צוות\s+/g, '')}</option>)}</TextField>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={() => setEditDialogOpen(false)}>ביטול</Button><Button onClick={handleEditSave} variant="contained" sx={{ px: 4 }}>שמור שינויים</Button></DialogActions>
            </Dialog>

            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ dir: 'rtl', sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>דחיית בקשה</DialogTitle>
                <DialogContent><TextField label="סיבת הדחייה (אופציונלי)" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} multiline rows={3} fullWidth sx={{ mt: 2, ...rtlFieldSx }} InputLabelProps={{ shrink: true }} /></DialogContent>
                <DialogActions><Button onClick={() => setRejectDialogOpen(false)}>ביטול</Button><Button onClick={() => handleReject(selectedRequest?.id, rejectionReason)} variant="contained" color="error">דחה בקשה</Button></DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>{snackbar.message}</Alert></Snackbar>
        </Container>
    );
}