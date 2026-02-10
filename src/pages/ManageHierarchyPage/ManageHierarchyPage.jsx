import React, { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import { 
    Box, Container, Typography, IconButton, Button, 
    Dialog, DialogTitle, DialogContent, TextField, 
    Collapse, List, Paper, Tooltip, CircularProgress,
    Alert, Snackbar
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Trash2, ChevronRight, ChevronDown, 
    Home, Users, Flag, Target, GitBranch 
} from 'lucide-react';
import { useOutletContext } from 'react-router';

export default function ManageHierarchyPage() {
    const context = useOutletContext() || {};
    const { isDark = false } = context;

    // States
    const [nodes, setNodes] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(true);
    
    // Dialog States
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newNodeData, setNewNodeData] = useState({ name: '', parent_id: null, group_type_id: 1 });
    
    // Delete Confirmation States
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [nodeToDelete, setNodeToDelete] = useState(null);
    
    // Feedback States
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('group_node')
                .select('*')
                .order('group_type_id', { ascending: true })
                .order('name', { ascending: true });
            
            if (error) throw error;
            setNodes(data || []);
        } catch (error) {
            showSnackbar('שגיאה בטעינת הנתונים: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const toggleExpand = (id) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSaveNode = async () => {
        if (!newNodeData.name.trim()) {
            showSnackbar('נא להזין שם יחידה', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('group_node')
                .insert([{
                    name: newNodeData.name.trim(),
                    parent_id: newNodeData.parent_id ? Number(newNodeData.parent_id) : null,
                    group_type_id: Number(newNodeData.group_type_id)
                }]);

            if (error) throw error;

            showSnackbar('היחידה נוספה בהצלחה');
            setDialogOpen(false);
            setNewNodeData({ name: '', parent_id: null, group_type_id: 1 });
            fetchData();
        } catch (error) {
            showSnackbar('שגיאה בהוספת יחידה: ' + error.message, 'error');
        }
    };

    // פונקציה לבדיקת היתכנות מחיקה ופתיחת הדיאלוג
    const openDeleteConfirm = (node) => {
        const hasChildren = nodes.some(n => n.parent_id === node.id);
        if (hasChildren) {
            showSnackbar(`לא ניתן למחוק את "${node.name}" כשיש תחתיו תת-יחידות`, 'error');
            return;
        }
        setNodeToDelete(node);
        setDeleteDialogOpen(true);
    };

    // ביצוע המחיקה בפועל
    const handleDeleteNode = async () => {
        if (!nodeToDelete) return;

        try {
            const { error } = await supabase.from('group_node').delete().eq('id', nodeToDelete.id);
            if (error) throw error;
            
            showSnackbar(`היחידה "${nodeToDelete.name}" נמחקה בהצלחה`);
            fetchData();
        } catch (error) {
            showSnackbar('שגיאה במחיקה: ' + error.message, 'error');
        } finally {
            setDeleteDialogOpen(false);
            setNodeToDelete(null);
        }
    };

    const renderTree = (parentId = null, level = 0) => {
        const children = nodes.filter(n => n.parent_id === parentId);
        if (children.length === 0) return null;

        return (
            <List disablePadding sx={{ mr: level > 0 ? 3 : 0 }}>
                {children.map((node) => {
                    const isExpanded = expanded[node.id];
                    const hasChildren = nodes.some(n => n.parent_id === node.id);

                    return (
                        <Box key={node.id} sx={{ mb: 1 }}>
                            <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                                        border: '1px solid',
                                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#eef2f6',
                                        borderRadius: '16px',
                                        '&:hover': { borderColor: '#6366f1', bgcolor: isDark ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.02)' }
                                    }}
                                >
                                    <Box 
                                        sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, cursor: 'pointer' }} 
                                        onClick={() => toggleExpand(node.id)}
                                    >
                                        <IconButton size="small" sx={{ color: '#6366f1', visibility: hasChildren ? 'visible' : 'hidden' }}>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </IconButton>
                                        
                                        {node.group_type_id === 1 && <Home size={22} color="#6366f1" />}
                                        {node.group_type_id === 2 && <Target size={22} color="#10b981" />}
                                        {node.group_type_id === 3 && <Flag size={22} color="#f59e0b" />}
                                        {node.group_type_id === 4 && <Users size={22} color="#ec4899" />}

                                        <Typography sx={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                                            {node.name}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        {node.group_type_id < 4 && (
                                            <Tooltip title="הוסף תת-יחידה">
                                                <IconButton size="small" onClick={() => {
                                                    setNewNodeData({ name: '', parent_id: node.id, group_type_id: node.group_type_id + 1 });
                                                    setDialogOpen(true);
                                                }}>
                                                    <Plus size={20} color="#6366f1" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        <IconButton size="small" onClick={() => openDeleteConfirm(node)}>
                                            <Trash2 size={18} color="#ef4444" />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            </motion.div>

                            <Collapse in={isExpanded}>
                                <Box sx={{ borderRight: '2px dashed', borderColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', mt: 1, mr: 2 }}>
                                    {renderTree(node.id, level + 1)}
                                </Box>
                            </Collapse>
                        </Box>
                    );
                })}
            </List>
        );
    };

    return (
        <Container maxWidth="md" sx={{ py: 6 }} dir="rtl">
            <Box sx={{ mb: 6, textAlign: 'center' }}>
                <GitBranch size={48} color="#6366f1" style={{ marginBottom: 16 }} />
                <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, color: isDark ? 'white' : '#1e293b' }}>
                    מבנה הבה"ד
                </Typography>
                <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
                    ניהול גדודים, פלוגות וצוותים בצורה דינאמית.
                </Typography>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ p: 3, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderRadius: '24px' }}>
                    {renderTree(null)}
                    {nodes.length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Button variant="contained" onClick={() => {
                                setNewNodeData({ name: '', parent_id: null, group_type_id: 1 });
                                setDialogOpen(true);
                            }}>התחל בבניית המבנה (בה"ד)</Button>
                        </Box>
                    )}
                </Box>
            )}

            {/* הוספת יחידה Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs" dir="rtl">
                <DialogTitle sx={{ fontWeight: 800 }}>הוספת יחידה חדשה</DialogTitle>
                <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField 
                        label="שם היחידה" 
                        fullWidth 
                        autoFocus
                        value={newNodeData.name}
                        onChange={(e) => setNewNodeData({...newNodeData, name: e.target.value})}
                        sx={{ mt: 1 }}
                    />
                    <Button 
                        variant="contained" 
                        fullWidth 
                        size="large"
                        sx={{ borderRadius: '12px', py: 1.5, fontWeight: 700 }}
                        onClick={handleSaveNode}
                    >
                        הוסף לעץ
                    </Button>
                </DialogContent>
            </Dialog>

            {/* דיאלוג אישור מחיקה מעוצב */}
            <Dialog 
                open={deleteDialogOpen} 
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{
                    sx: { borderRadius: '20px', p: 1 }
                }}
                dir="rtl"
            >
                <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>
                    אישור מחיקה
                </DialogTitle>
                <DialogContent>
                    <Typography textAlign="center" sx={{ color: isDark ? '#f8fafc' : '#1e293b' }}>
                        האם אתה בטוח שברצונך למחוק את <strong>{nodeToDelete?.name}</strong>?
                        <br />
                        פעולה זו אינה ניתנת לביטול.
                    </Typography>
                </DialogContent>
                <Box sx={{ display: 'flex', gap: 2, p: 2, justifyContent: 'center' }}>
                    <Button 
                        onClick={() => setDeleteDialogOpen(false)}
                        variant="outlined"
                        sx={{ borderRadius: '12px', flex: 1, color: isDark ? 'white' : 'inherit', borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'inherit' }}
                    >
                        ביטול
                    </Button>
                    <Button 
                        onClick={handleDeleteNode}
                        variant="contained" 
                        color="error"
                        sx={{ borderRadius: '12px', flex: 1, fontWeight: 700 }}
                    >
                        מחק יחידה
                    </Button>
                </Box>
            </Dialog>

            {/* Snackbar להודעות שגיאה והצלחה */}
            <Snackbar 
                open={snackbar.open} 
                autoHideDuration={4000} 
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}