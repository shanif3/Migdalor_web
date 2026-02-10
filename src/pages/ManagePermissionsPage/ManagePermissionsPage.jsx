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
    MenuItem,
    Alert,
    Snackbar,
    CircularProgress,
    Checkbox,
    FormControlLabel,
    FormGroup
} from '@mui/material';
import { motion } from 'framer-motion';
import {
    Search,
    Shield,
    Users,
    Briefcase,
    Edit2,
    Trash2,
    Plus,
    Save,
    X,
    UserCheck
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { supabase } from 'lib/supabaseClient';

export default function ManagePermissionsPage() {
    const { user, isDark } = useOutletContext();
    const navigate = useNavigate();

    const [currentTab, setCurrentTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Users state
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [userRolesMap, setUserRolesMap] = useState({}); // { oderId: [roleId1, roleId2, ...] }

    // Edit user roles dialog
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRoles, setSelectedRoles] = useState([]);

    // Role management dialog
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleForm, setRoleForm] = useState({ name: '', scope: 'כללי', type: 'כללי', week: 0 });

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);

    // Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Statistics
    const [stats, setStats] = useState({ totalUsers: 0, totalRoles: 0, usersWithRoles: 0, usersWithoutRealRoles: 0 });

    // Filter state
    const [activeFilter, setActiveFilter] = useState(null); // null, 'total', 'withRoles', 'withoutRoles'

    // Enum options from database
    const [scopeOptions, setScopeOptions] = useState([]);
    const [typeOptions, setTypeOptions] = useState([]);

    const isAdmin = user?.roles?.includes('מנהל');
    const isStaff = user?.roles?.includes('סגל');
    const hasAccess = isAdmin || isStaff;

    // Current user's hierarchy info
    const [currentUserHierarchy, setCurrentUserHierarchy] = useState(null);
    
    // View mode for admin: 'all' or 'myGroup'
    const [viewMode, setViewMode] = useState('all');

    useEffect(() => {
        if (!user) return;
        if (!hasAccess) {
            navigate('/Home');
            return;
        }
        fetchEnumValues();
        fetchData();
    }, [user, hasAccess, navigate]);

    const fetchEnumValues = async () => {
        try {
            // Fetch enum values directly using SQL query
            const { data: scopeData, error: scopeError } = await supabase
                .from('roles')
                .select('scope')
                .limit(1);

            // Get enum values by querying pg_enum through a raw SQL approach
            // Since we can't query pg_enum directly, we'll get the column's enum values
            // by using a workaround - fetch from information_schema or use the existing roles
            
            // Alternative: Query using postgres function via rpc
            const { data: enumData, error: enumError } = await supabase.rpc('get_enum_values', { 
                enum_name: 'role_scope_enum' 
            });
            
            if (!enumError && enumData) {
                setScopeOptions(enumData);
            }

            const { data: typeEnumData, error: typeEnumError } = await supabase.rpc('get_enum_values', { 
                enum_name: 'role_type_enum' 
            });
            
            if (!typeEnumError && typeEnumData) {
                setTypeOptions(typeEnumData);
            }

        } catch (error) {
            console.error('Error fetching enum values:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get current authenticated user from Supabase Auth
            const { data: { user: authUser } } = await supabase.auth.getUser();
            console.log('[PERMISSIONS] Auth user:', authUser);
            
            // Fetch users with group_id
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, full_name, email, phone, group_id')
                .order('full_name');

            if (usersError) throw usersError;

            // Fetch group nodes for hierarchy
            const { data: groupNodes, error: groupError } = await supabase
                .from('group_node')
                .select('id, name, group_type_id, parent_id');

            if (groupError) throw groupError;

            // Create nodes map
            const nodesMap = {};
            if (groupNodes) {
                groupNodes.forEach(node => { nodesMap[node.id] = node; });
            }

            // Function to get hierarchy from group_id
            const getHierarchy = (groupId) => {
                const result = { team_id: null, team_name: null, company_id: null, company_name: null, battalion_id: null, battalion_name: null };
                if (!groupId || !nodesMap[groupId]) return result;
                let currentNode = nodesMap[groupId];
                const path = [];
                while (currentNode) {
                    path.push(currentNode);
                    if (currentNode.parent_id && nodesMap[currentNode.parent_id]) {
                        currentNode = nodesMap[currentNode.parent_id];
                    } else break;
                }
                path.forEach(node => {
                    if (node.group_type_id === 4) {
                        result.team_id = node.id;
                        result.team_name = node.name.replace(/^צוות\s+/g, '').trim();
                    } else if (node.group_type_id === 3) {
                        result.company_id = node.id;
                        result.company_name = node.name;
                    } else if (node.group_type_id === 2) {
                        result.battalion_id = node.id;
                        result.battalion_name = node.name;
                    }
                });
                return result;
            };

            // Add hierarchy to users
            const usersWithHierarchy = (usersData || []).map(u => ({
                ...u,
                ...getHierarchy(u.group_id)
            }));

            // Fetch roles
            const { data: rolesData, error: rolesError } = await supabase
                .from('roles')
                .select('*')
                .order('id');

            if (rolesError) throw rolesError;

            // Fetch user_roles (supports multiple roles per user)
            const { data: userRolesData, error: userRolesError } = await supabase
                .from('user_roles')
                .select('user_id, role_id');

            if (userRolesError) throw userRolesError;

            // Create map: userId -> [roleId1, roleId2, ...]
            const rolesMap = {};
            userRolesData?.forEach(ur => {
                if (!rolesMap[ur.user_id]) {
                    rolesMap[ur.user_id] = [];
                }
                rolesMap[ur.user_id].push(ur.role_id);
            });

            // Find the "צוער" role id
            const tzoarRole = rolesData?.find(r => r.name === 'צוער');
            const tzoarRoleId = tzoarRole?.id;

            // Calculate users without any roles (excluding צוער)
            const usersWithoutRealRoles = usersWithHierarchy.filter(u => {
                const userRoleIds = rolesMap[u.id] || [];
                // User has no roles at all, or only has צוער role
                if (userRoleIds.length === 0) return true;
                if (tzoarRoleId && userRoleIds.length === 1 && userRoleIds[0] === tzoarRoleId) return true;
                return false;
            }).length;

            setUsers(usersWithHierarchy);
            setRoles(rolesData || []);
            setUserRolesMap(rolesMap);

            // Find current user's hierarchy using auth user email
            console.log('[PERMISSIONS] Looking for user with email:', authUser?.email);
            
            const currentUserData = usersWithHierarchy.find(u => u.email === authUser?.email);
            
            console.log('[PERMISSIONS] Current user data found:', currentUserData);
            if (currentUserData) {
                const hierarchy = {
                    battalion_id: currentUserData.battalion_id,
                    battalion_name: currentUserData.battalion_name,
                    company_id: currentUserData.company_id,
                    company_name: currentUserData.company_name,
                    team_id: currentUserData.team_id,
                    team_name: currentUserData.team_name
                };
                console.log('[PERMISSIONS] Setting hierarchy:', hierarchy);
                setCurrentUserHierarchy(hierarchy);
            } else {
                console.log('[PERMISSIONS] User not found in users list');
            }

            setStats({
                totalUsers: usersWithHierarchy?.length || 0,
                totalRoles: rolesData?.length || 0,
                usersWithRoles: Object.keys(rolesMap).length,
                usersWithoutRealRoles: usersWithoutRealRoles
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            setSnackbar({ open: true, message: 'שגיאה בטעינת הנתונים', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const getRoleNames = (userId) => {
        const roleIds = userRolesMap[userId] || [];
        return roleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean);
    };

    const getUserCountForRole = (roleId) => {
        return Object.values(userRolesMap).filter(roleIds => roleIds.includes(roleId)).length;
    };

    // ============ User Role Edit ============
    const openEditDialog = (userItem) => {
        setSelectedUser(userItem);
        setSelectedRoles(userRolesMap[userItem.id] || []);
        setEditDialogOpen(true);
    };

    const handleRoleToggle = (roleId) => {
        setSelectedRoles(prev => 
            prev.includes(roleId) 
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    const handleSaveUserRoles = async () => {
        if (!selectedUser) return;

        try {
            // Delete existing roles for this user
            await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', selectedUser.id);

            // Insert new roles
            if (selectedRoles.length > 0) {
                const inserts = selectedRoles.map(roleId => ({
                    user_id: selectedUser.id,
                    role_id: roleId,
                    assigned_date: new Date().toISOString()
                }));

                const { error } = await supabase
                    .from('user_roles')
                    .insert(inserts);

                if (error) throw error;
            }

            // Update local state
            setUserRolesMap(prev => ({
                ...prev,
                [selectedUser.id]: selectedRoles
            }));

            setSnackbar({ open: true, message: 'התפקידים עודכנו בהצלחה', severity: 'success' });
            setEditDialogOpen(false);
        } catch (error) {
            console.error('Error saving roles:', error);
            setSnackbar({ open: true, message: 'שגיאה בשמירת התפקידים', severity: 'error' });
        }
    };

    // ============ Role Management ============
    const openRoleDialog = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleForm({ 
                name: role.name, 
                scope: role.scope || 'כללי', 
                type: role.type || 'כללי',
                week: role.week || 0
            });
        } else {
            setEditingRole(null);
            setRoleForm({ name: '', scope: 'כללי', type: 'כללי', week: 0 });
        }
        setRoleDialogOpen(true);
    };

    const handleSaveRole = async () => {
        if (!roleForm.name.trim()) {
            setSnackbar({ open: true, message: 'נא להזין שם תפקיד', severity: 'error' });
            return;
        }

        console.log('[SAVE ROLE] Saving role:', roleForm);
        console.log('[SAVE ROLE] Editing existing?', !!editingRole);

        try {
            if (editingRole) {
                console.log('[SAVE ROLE] Updating role ID:', editingRole.id);
                const { data, error } = await supabase
                    .from('roles')
                    .update({
                        name: roleForm.name,
                        scope: roleForm.scope,
                        type: roleForm.type,
                        week: roleForm.week
                    })
                    .eq('id', editingRole.id);

                console.log('[SAVE ROLE] Update result:', { data, error });
                if (error) throw error;
                setSnackbar({ open: true, message: 'התפקיד עודכן בהצלחה', severity: 'success' });
            } else {
                console.log('[SAVE ROLE] Creating new role');
                const { data, error } = await supabase
                    .from('roles')
                    .insert({
                        name: roleForm.name,
                        scope: roleForm.scope,
                        type: roleForm.type,
                        week: roleForm.week
                    });

                console.log('[SAVE ROLE] Insert result:', { data, error });
                if (error) throw error;
                setSnackbar({ open: true, message: 'התפקיד נוצר בהצלחה', severity: 'success' });
            }

            setRoleDialogOpen(false);
            fetchData();
        } catch (error) {
            console.error('[SAVE ROLE] Error saving role:', error);
            setSnackbar({ open: true, message: `שגיאה בשמירת התפקיד: ${error.message}`, severity: 'error' });
        }
    };

    const openDeleteRoleDialog = (role) => {
        setRoleToDelete(role);
        setDeleteDialogOpen(true);
    };

    const handleDeleteRole = async () => {
        if (!roleToDelete) return;

        const usersWithRole = getUserCountForRole(roleToDelete.id);
        if (usersWithRole > 0) {
            setSnackbar({ 
                open: true, 
                message: `לא ניתן למחוק - ${usersWithRole} משתמשים משויכים לתפקיד זה`, 
                severity: 'error' 
            });
            setDeleteDialogOpen(false);
            return;
        }

        try {
            const { error } = await supabase
                .from('roles')
                .delete()
                .eq('id', roleToDelete.id);

            if (error) throw error;

            setSnackbar({ open: true, message: 'התפקיד נמחק בהצלחה', severity: 'success' });
            setDeleteDialogOpen(false);
            setRoleToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Error deleting role:', error);
            setSnackbar({ open: true, message: 'שגיאה במחיקת התפקיד', severity: 'error' });
        }
    };

    // Filter users by search, activeFilter, and group hierarchy
    const filteredUsers = users.filter(u => {
        // First apply search filter
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            u.full_name?.toLowerCase().includes(search) ||
            u.email?.toLowerCase().includes(search) ||
            u.phone?.includes(searchTerm)
        );
        
        if (!matchesSearch) return false;

        // Apply hierarchy filter based on role
        // If user is staff (not admin), only show users in same group
        // If user is admin and viewMode is 'myGroup', filter by group
        if (!isAdmin || viewMode === 'myGroup') {
            if (currentUserHierarchy) {
                console.log('[FILTER] Checking user:', u.full_name, 'team_id:', u.team_id, 'vs my team_id:', currentUserHierarchy.team_id);
                
                // Filter by same team first (most specific)
                if (currentUserHierarchy.team_id) {
                    if (u.team_id !== currentUserHierarchy.team_id) {
                        return false;
                    }
                }
                // If no team, filter by company
                else if (currentUserHierarchy.company_id) {
                    if (u.company_id !== currentUserHierarchy.company_id) {
                        return false;
                    }
                }
                // If no company, filter by battalion
                else if (currentUserHierarchy.battalion_id) {
                    if (u.battalion_id !== currentUserHierarchy.battalion_id) {
                        return false;
                    }
                }
            }
        }

        // Then apply stats filter
        if (activeFilter === 'total') {
            return true; // Show all users
        }
        
        if (activeFilter === 'withoutRoles') {
            const userRoleIds = userRolesMap[u.id] || [];
            const tzoarRole = roles.find(r => r.name === 'צוער');
            const tzoarRoleId = tzoarRole?.id;
            
            // User has no roles at all, or only has צוער role
            if (userRoleIds.length === 0) return true;
            if (tzoarRoleId && userRoleIds.length === 1 && userRoleIds[0] === tzoarRoleId) return true;
            return false;
        }
        
        if (activeFilter === 'withRoles') {
            return (userRolesMap[u.id] || []).length > 0;
        }

        return true;
    });

    const rtlFieldSx = {
        '& .MuiInputBase-root': {
            borderRadius: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff'
        },
        '& .MuiInputBase-input': { textAlign: 'right' },
        '& .MuiInputLabel-root': {
            right: 14,
            left: 'auto',
            transformOrigin: 'top right',
            textAlign: 'right',
            padding: '0 4px',
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            zIndex: 1
        },
        '& .MuiInputLabel-shrink': { 
            transform: 'translate(0, -9px) scale(0.75)',
            right: 14 
        },
        '& .MuiOutlinedInput-notchedOutline': {
            textAlign: 'right',
            '& legend': { textAlign: 'right', width: 'auto' }
        }
    };

    const cellStyle = { 
        color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', 
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', 
        textAlign: 'center' 
    };

    if (!user) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!hasAccess) {
        return (
            <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
                <Shield size={64} color="#ef4444" />
                <Typography variant="h5" sx={{ mt: 2, fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>
                    אין הרשאת גישה
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }} dir="rtl">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Shield size={32} style={{ color: '#6366f1' }} />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>
                            ניהול הרשאות
                        </Typography>
                    </Box>
                    <Typography sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b' }}>
                        ניהול תפקידים והרשאות משתמשים במערכת
                    </Typography>
                </Box>
            </motion.div>

            {/* Statistics - Clickable */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {[
                    { key: 'total', label: 'סה"כ משתמשים', value: stats.totalUsers, color: '#6366f1' },
                    { key: 'roles', label: 'סה"כ תפקידים', value: stats.totalRoles, color: '#10b981', notClickable: true },
                    { key: 'withRoles', label: 'משתמשים עם תפקיד', value: stats.usersWithRoles, color: '#f59e0b' },
                    { key: 'withoutRoles', label: 'ללא הרשאות', value: stats.usersWithoutRealRoles, color: '#ef4444' }
                ].map((stat, idx) => (
                    <Card 
                        key={idx}
                        onClick={() => {
                            if (stat.notClickable) return;
                            if (activeFilter === stat.key) {
                                setActiveFilter(null);
                            } else {
                                setActiveFilter(stat.key);
                                setCurrentTab(0); // Switch to users tab
                            }
                        }}
                        sx={{ 
                            flex: '1 1 200px',
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                            borderRadius: '16px',
                            border: activeFilter === stat.key 
                                ? `3px solid ${stat.color}` 
                                : (idx === 0 ? `2px solid ${stat.color}` : 'none'),
                            cursor: stat.notClickable ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': stat.notClickable ? {} : {
                                transform: 'translateY(-2px)',
                                boxShadow: isDark 
                                    ? `0 4px 20px rgba(99, 102, 241, 0.2)` 
                                    : `0 4px 20px rgba(0,0,0,0.1)`
                            }
                        }}
                    >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                            <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b', mb: 1 }}>
                                {stat.label}
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 700, color: activeFilter === stat.key ? stat.color : (isDark ? 'white' : '#1e293b') }}>
                                {stat.value}
                            </Typography>
                            {activeFilter === stat.key && (
                                <Chip 
                                    label="מסנן פעיל" 
                                    size="small" 
                                    sx={{ 
                                        mt: 1, 
                                        bgcolor: `${stat.color}20`, 
                                        color: stat.color,
                                        fontWeight: 500 
                                    }} 
                                />
                            )}
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {/* Active filter indicator */}
            {activeFilter && (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
                        מסנן לפי:
                    </Typography>
                    <Chip 
                        label={
                            activeFilter === 'total' ? 'כל המשתמשים' :
                            activeFilter === 'withRoles' ? 'משתמשים עם תפקיד' :
                            activeFilter === 'withoutRoles' ? 'ללא הרשאות' : ''
                        }
                        onDelete={() => setActiveFilter(null)}
                        sx={{ 
                            bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                            color: '#6366f1',
                            fontWeight: 500
                        }}
                    />
                </Box>
            )}

            {/* Tabs */}
            <Card sx={{ mb: 3, bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', borderRadius: '16px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2 }}>
                    <Tabs 
                        value={currentTab} 
                        onChange={(e, v) => setCurrentTab(v)}
                        sx={{ '& .MuiTabs-indicator': { bgcolor: '#6366f1' } }}
                    >
                        <Tab icon={<Users size={18} />} iconPosition="start" label="משתמשים" />
                        <Tab icon={<Briefcase size={18} />} iconPosition="start" label="תפקידים" />
                    </Tabs>
                    
                    {/* View mode toggle for admin */}
                    {isAdmin && currentTab === 0 && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                                label="כל המשתמשים"
                                onClick={() => setViewMode('all')}
                                sx={{
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    bgcolor: viewMode === 'all' 
                                        ? 'rgba(99, 102, 241, 0.2)' 
                                        : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                                    color: viewMode === 'all' 
                                        ? '#6366f1' 
                                        : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'),
                                    border: viewMode === 'all' 
                                        ? '2px solid #6366f1' 
                                        : '2px solid transparent',
                                    '&:hover': {
                                        bgcolor: viewMode === 'all' 
                                            ? 'rgba(99, 102, 241, 0.3)' 
                                            : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                                    },
                                }}
                            />
                            <Chip
                                label={currentUserHierarchy?.team_name 
                                    ? `צוות ${currentUserHierarchy.team_name}` 
                                    : currentUserHierarchy?.company_name 
                                        ? currentUserHierarchy.company_name 
                                        : 'השיוך שלי'}
                                onClick={() => setViewMode('myGroup')}
                                sx={{
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    bgcolor: viewMode === 'myGroup' 
                                        ? 'rgba(16, 185, 129, 0.2)' 
                                        : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                                    color: viewMode === 'myGroup' 
                                        ? '#10b981' 
                                        : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'),
                                    border: viewMode === 'myGroup' 
                                        ? '2px solid #10b981' 
                                        : '2px solid transparent',
                                    '&:hover': {
                                        bgcolor: viewMode === 'myGroup' 
                                            ? 'rgba(16, 185, 129, 0.3)' 
                                            : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                                    },
                                }}
                            />
                        </Box>
                    )}
                    
                    {/* Show current group info for staff */}
                    {!isAdmin && currentTab === 0 && currentUserHierarchy && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b', fontSize: '0.85rem' }}>
                                מציג:
                            </Typography>
                            <Chip
                                label={currentUserHierarchy?.team_name 
                                    ? `צוות ${currentUserHierarchy.team_name}` 
                                    : currentUserHierarchy?.company_name || 'השיוך שלי'}
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10b981',
                                    fontWeight: 500
                                }}
                            />
                        </Box>
                    )}
                </Box>
            </Card>

            {/* Users Tab */}
            {currentTab === 0 && (
                <>
                    {/* Search */}
                    <Card sx={{ mb: 3, bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', borderRadius: '16px' }}>
                        <CardContent>
                            <TextField
                                placeholder="חיפוש לפי שם, אימייל או טלפון..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                fullWidth
                                InputProps={{
                                    startAdornment: <Search size={20} style={{ marginLeft: 8, color: '#64748b' }} />
                                }}
                                sx={{
                                    ...rtlFieldSx,
                                    '& .MuiOutlinedInput-root': { 
                                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc' 
                                    }
                                }}
                            />
                        </CardContent>
                    </Card>

                    {/* Users Table */}
                    <Card sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', borderRadius: '16px' }}>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={cellStyle}>שם מלא</TableCell>
                                        <TableCell sx={cellStyle}>אימייל</TableCell>
                                        <TableCell sx={cellStyle}>טלפון</TableCell>
                                        <TableCell sx={cellStyle}>גדוד</TableCell>
                                        <TableCell sx={cellStyle}>פלוגה</TableCell>
                                        <TableCell sx={cellStyle}>צוות</TableCell>
                                        <TableCell sx={cellStyle}>תפקידים</TableCell>
                                        <TableCell sx={cellStyle}>פעולות</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                                <CircularProgress />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 4, ...cellStyle }}>
                                                אין משתמשים להצגה
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((userItem) => {
                                            const roleNames = getRoleNames(userItem.id);
                                            return (
                                                <TableRow key={userItem.id}>
                                                    <TableCell sx={cellStyle}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                                                            <UserCheck size={18} color="#6366f1" />
                                                            <Typography sx={{ fontWeight: 600 }}>
                                                                {userItem.full_name || 'ללא שם'}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ ...cellStyle, direction: 'ltr' }}>
                                                        {userItem.email || '—'}
                                                    </TableCell>
                                                    <TableCell sx={cellStyle}>
                                                        {userItem.phone || '—'}
                                                    </TableCell>
                                                    <TableCell sx={cellStyle}>
                                                        {userItem.battalion_name || '—'}
                                                    </TableCell>
                                                    <TableCell sx={cellStyle}>
                                                        {userItem.company_name || '—'}
                                                    </TableCell>
                                                    <TableCell sx={cellStyle}>
                                                        {userItem.team_name || '—'}
                                                    </TableCell>
                                                    <TableCell sx={cellStyle}>
                                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                                            {roleNames.length > 0 ? (
                                                                roleNames.map((name, idx) => (
                                                                    <Chip
                                                                        key={idx}
                                                                        label={name}
                                                                        size="small"
                                                                        sx={{
                                                                            bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                                            color: '#6366f1',
                                                                            fontWeight: 500
                                                                        }}
                                                                    />
                                                                ))
                                                            ) : (
                                                                <Chip
                                                                    label="ללא תפקיד"
                                                                    size="small"
                                                                    sx={{
                                                                        bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                                                        color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b'
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={cellStyle}>
                                                        <IconButton 
                                                            onClick={() => openEditDialog(userItem)}
                                                            sx={{ color: '#6366f1' }}
                                                        >
                                                            <Edit2 size={18} />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </>
            )}

            {/* Roles Tab */}
            {currentTab === 1 && (
                <>
                    {/* Add Role Button */}
                    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-start' }}>
                        <Button
                            variant="contained"
                            startIcon={<Plus size={18} />}
                            onClick={() => openRoleDialog()}
                            sx={{
                                bgcolor: '#6366f1',
                                '&:hover': { bgcolor: '#4f46e5' },
                                borderRadius: 2,
                                px: 3
                            }}
                        >
                            הוסף תפקיד חדש
                        </Button>
                    </Box>

                    {/* Roles List */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {roles.map((role) => {
                            const userCount = getUserCountForRole(role.id);
                            return (
                                <Card
                                    key={role.id}
                                    sx={{
                                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                        borderRadius: '16px',
                                        '&:hover': { 
                                            boxShadow: isDark 
                                                ? '0 4px 20px rgba(99, 102, 241, 0.2)' 
                                                : '0 4px 20px rgba(0,0,0,0.1)' 
                                        },
                                        transition: 'box-shadow 0.2s'
                                    }}
                                >
                                    <CardContent sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 2,
                                        '&:last-child': { pb: 2 }
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Briefcase size={24} color="#6366f1" />
                                            <Box>
                                                <Typography 
                                                    variant="h6" 
                                                    sx={{ fontWeight: 600, color: isDark ? 'white' : '#1e293b' }}
                                                >
                                                    {role.name}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                    <Chip
                                                        label={`סוג: ${role.scope || 'כללי'}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ 
                                                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                                                            color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b'
                                                        }}
                                                    />
                                                    <Chip
                                                        label={`קטגוריה: ${role.type || 'כללי'}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ 
                                                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                                                            color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Chip
                                                label={`${userCount} משתמשים`}
                                                sx={{
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                                    color: isDark ? 'white' : '#1e293b',
                                                    fontWeight: 500
                                                }}
                                            />
                                            <IconButton
                                                onClick={() => openRoleDialog(role)}
                                                sx={{ color: '#6366f1' }}
                                            >
                                                <Edit2 size={18} />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => openDeleteRoleDialog(role)}
                                                sx={{ color: '#ef4444' }}
                                            >
                                                <Trash2 size={18} />
                                            </IconButton>
                                        </Box>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {roles.length === 0 && !loading && (
                            <Card sx={{ 
                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', 
                                borderRadius: '16px',
                                py: 6,
                                textAlign: 'center'
                            }}>
                                <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>
                                    אין תפקידים במערכת
                                </Typography>
                            </Card>
                        )}
                    </Box>
                </>
            )}

            {/* Edit User Roles Dialog */}
            <Dialog 
                open={editDialogOpen} 
                onClose={() => setEditDialogOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{ 
                    dir: 'rtl', 
                    sx: { 
                        borderRadius: 3,
                        bgcolor: isDark ? '#1e1e2e' : 'white',
                        maxHeight: '80vh'
                    } 
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>
                    עריכת תפקידים - {selectedUser?.full_name}
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 3, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
                        בחר את התפקידים עבור משתמש זה:
                    </Typography>
                    
                    {(() => {
                        // Sort and group roles
                        const sortedRoles = [...roles].sort((a, b) => {
                            // First by week
                            if ((a.week || 0) !== (b.week || 0)) {
                                return (a.week || 0) - (b.week || 0);
                            }
                            // Then by scope
                            if (a.scope !== b.scope) {
                                return (a.scope || '').localeCompare(b.scope || '');
                            }
                            // Then by type
                            return (a.type || '').localeCompare(b.type || '');
                        });

                        // Group by week
                        const groupedByWeek = sortedRoles.reduce((acc, role) => {
                            const week = role.week || 0;
                            if (!acc[week]) acc[week] = [];
                            acc[week].push(role);
                            return acc;
                        }, {});

                        return Object.entries(groupedByWeek).map(([week, weekRoles]) => {
                            // Group by scope within week
                            const groupedByScope = weekRoles.reduce((acc, role) => {
                                const scope = role.scope || 'כללי';
                                if (!acc[scope]) acc[scope] = [];
                                acc[scope].push(role);
                                return acc;
                            }, {});

                            return (
                                <Box key={week} sx={{ mb: 3 }}>
                                    {/* Week Header */}
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1, 
                                        mb: 2,
                                        pb: 1,
                                        borderBottom: `2px solid ${isDark ? 'rgba(99, 102, 241, 0.3)' : '#e2e8f0'}`
                                    }}>
                                        <Typography 
                                            variant="h6" 
                                            sx={{ 
                                                fontWeight: 700, 
                                                color: '#6366f1'
                                            }}
                                        >
                                            {week === '0' ? 'כללי' : `שבוע ${week}`}
                                        </Typography>
                                    </Box>

                                    {Object.entries(groupedByScope).map(([scope, scopeRoles]) => {
                                        // Group by type within scope
                                        const groupedByType = scopeRoles.reduce((acc, role) => {
                                            const type = role.type || 'כללי';
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(role);
                                            return acc;
                                        }, {});

                                        return (
                                            <Box key={scope} sx={{ mb: 2, mr: 2 }}>
                                                {/* Scope Header */}
                                                <Typography 
                                                    sx={{ 
                                                        fontWeight: 600, 
                                                        color: isDark ? 'rgba(255,255,255,0.8)' : '#334155',
                                                        mb: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1
                                                    }}
                                                >
                                                    <Box 
                                                        sx={{ 
                                                            width: 8, 
                                                            height: 8, 
                                                            borderRadius: '50%', 
                                                            bgcolor: '#10b981' 
                                                        }} 
                                                    />
                                                    {scope}
                                                </Typography>

                                                {Object.entries(groupedByType).map(([type, typeRoles]) => (
                                                    <Box key={type} sx={{ mr: 3, mb: 1 }}>
                                                        {/* Type Label */}
                                                        <Typography 
                                                            variant="body2" 
                                                            sx={{ 
                                                                color: isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8',
                                                                mb: 0.5,
                                                                fontSize: '0.75rem'
                                                            }}
                                                        >
                                                            {type}
                                                        </Typography>

                                                        {/* Roles as Chips */}
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                            {typeRoles.map((role) => {
                                                                const isSelected = selectedRoles.includes(role.id);
                                                                return (
                                                                    <Chip
                                                                        key={role.id}
                                                                        label={role.name}
                                                                        onClick={() => handleRoleToggle(role.id)}
                                                                        sx={{
                                                                            cursor: 'pointer',
                                                                            fontWeight: 500,
                                                                            bgcolor: isSelected 
                                                                                ? 'rgba(99, 102, 241, 0.2)' 
                                                                                : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                                                                            color: isSelected 
                                                                                ? '#6366f1' 
                                                                                : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'),
                                                                            border: isSelected 
                                                                                ? '2px solid #6366f1' 
                                                                                : '2px solid transparent',
                                                                            '&:hover': {
                                                                                bgcolor: isSelected 
                                                                                    ? 'rgba(99, 102, 241, 0.3)' 
                                                                                    : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                                                                            },
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            );
                        });
                    })()}

                    {/* Selected roles summary */}
                    {selectedRoles.length > 0 && (
                        <Box sx={{ 
                            mt: 3, 
                            pt: 2, 
                            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` 
                        }}>
                            <Typography sx={{ 
                                fontWeight: 600, 
                                color: isDark ? 'white' : '#1e293b',
                                mb: 1 
                            }}>
                                תפקידים נבחרים ({selectedRoles.length}):
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {selectedRoles.map(roleId => {
                                    const role = roles.find(r => r.id === roleId);
                                    return role ? (
                                        <Chip
                                            key={roleId}
                                            label={role.name}
                                            onDelete={() => handleRoleToggle(roleId)}
                                            sx={{
                                                bgcolor: 'rgba(99, 102, 241, 0.2)',
                                                color: '#6366f1',
                                                fontWeight: 500,
                                                '& .MuiChip-deleteIcon': {
                                                    color: '#6366f1',
                                                    '&:hover': { color: '#4f46e5' }
                                                }
                                            }}
                                        />
                                    ) : null;
                                })}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button 
                        onClick={() => setEditDialogOpen(false)}
                        sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b' }}
                    >
                        ביטול
                    </Button>
                    <Button 
                        onClick={handleSaveUserRoles}
                        variant="contained"
                        startIcon={<Save size={18} />}
                        sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
                    >
                        שמור שינויים
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create/Edit Role Dialog */}
            <Dialog
                open={roleDialogOpen}
                onClose={() => setRoleDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ 
                    dir: 'rtl', 
                    sx: { 
                        borderRadius: 3,
                        bgcolor: isDark ? '#1e1e2e' : 'white'
                    } 
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>
                    {editingRole ? 'עריכת תפקיד' : 'הוספת תפקיד חדש'}
                </DialogTitle>
                <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField
                        label="שם התפקיד"
                        value={roleForm.name}
                        onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                        fullWidth
                        required
                        sx={rtlFieldSx}
                        InputLabelProps={{ shrink: true }}
                    />
                    <Box>
                        <Typography sx={{ 
                            color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
                            mb: 1,
                            fontSize: '0.9rem'
                        }}>
                            סוג (Scope)
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {scopeOptions.map((option) => (
                                <Chip
                                    key={option}
                                    label={option}
                                    onClick={() => setRoleForm({ ...roleForm, scope: option })}
                                    sx={{
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                        bgcolor: roleForm.scope === option 
                                            ? 'rgba(99, 102, 241, 0.2)' 
                                            : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                                        color: roleForm.scope === option 
                                            ? '#6366f1' 
                                            : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'),
                                        border: roleForm.scope === option 
                                            ? '2px solid #6366f1' 
                                            : '2px solid transparent',
                                        '&:hover': {
                                            bgcolor: roleForm.scope === option 
                                                ? 'rgba(99, 102, 241, 0.3)' 
                                                : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                                        },
                                        transition: 'all 0.2s'
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                    <Box>
                        <Typography sx={{ 
                            color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
                            mb: 1,
                            fontSize: '0.9rem'
                        }}>
                            קטגוריה (Type)
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {typeOptions.map((option) => (
                                <Chip
                                    key={option}
                                    label={option}
                                    onClick={() => setRoleForm({ ...roleForm, type: option })}
                                    sx={{
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                        bgcolor: roleForm.type === option 
                                            ? 'rgba(16, 185, 129, 0.2)' 
                                            : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                                        color: roleForm.type === option 
                                            ? '#10b981' 
                                            : (isDark ? 'rgba(255,255,255,0.7)' : '#64748b'),
                                        border: roleForm.type === option 
                                            ? '2px solid #10b981' 
                                            : '2px solid transparent',
                                        '&:hover': {
                                            bgcolor: roleForm.type === option 
                                                ? 'rgba(16, 185, 129, 0.3)' 
                                                : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                                        },
                                        transition: 'all 0.2s'
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ 
                            color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
                            minWidth: 60
                        }}>
                            שבוע
                        </Typography>
                        <IconButton
                            onClick={() => setRoleForm({ ...roleForm, week: Math.max(0, (roleForm.week || 0) - 1) })}
                            sx={{ 
                                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0' }
                            }}
                            size="small"
                        >
                            <span style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? 'white' : '#1e293b' }}>−</span>
                        </IconButton>
                        <TextField
                            type="number"
                            value={roleForm.week}
                            onChange={(e) => setRoleForm({ ...roleForm, week: Math.max(0, parseInt(e.target.value) || 0) })}
                            sx={{
                                width: 80,
                                '& .MuiInputBase-root': {
                                    borderRadius: 2,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff'
                                },
                                '& .MuiInputBase-input': { 
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    fontSize: '1.1rem',
                                    py: 1
                                },
                                '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                                    display: 'none'
                                }
                            }}
                            inputProps={{ min: 0 }}
                        />
                        <IconButton
                            onClick={() => setRoleForm({ ...roleForm, week: (roleForm.week || 0) + 1 })}
                            sx={{ 
                                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0' }
                            }}
                            size="small"
                        >
                            <Plus size={18} color={isDark ? 'white' : '#1e293b'} />
                        </IconButton>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button 
                        onClick={() => setRoleDialogOpen(false)}
                        sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b' }}
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleSaveRole}
                        variant="contained"
                        sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
                    >
                        {editingRole ? 'שמור שינויים' : 'צור תפקיד'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Role Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{ 
                    dir: 'rtl', 
                    sx: { 
                        borderRadius: 3,
                        bgcolor: isDark ? '#1e1e2e' : 'white'
                    } 
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>
                    מחיקת תפקיד
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.8)' : '#334155' }}>
                        האם אתה בטוח שברצונך למחוק את התפקיד "{roleToDelete?.name}"?
                    </Typography>
                    <Typography 
                        variant="body2" 
                        sx={{ mt: 1, color: '#ef4444' }}
                    >
                        פעולה זו לא ניתנת לביטול.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button 
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b' }}
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleDeleteRole}
                        variant="contained"
                        color="error"
                    >
                        מחק
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}