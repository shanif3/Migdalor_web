import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Button, TextField, Card, Typography, Dialog, DialogTitle,
    DialogContent, DialogActions, Select, MenuItem, FormControl,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox, FormControlLabel,
    Chip, IconButton, Grid, Container, Paper, TableContainer, CircularProgress,
    Stack
} from '@mui/material';
import { motion } from 'framer-motion';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';
import {
    Plus, Clock, Trash2, Key, CheckCircle,
    Edit2, Calendar, X, Minus, Users
} from 'lucide-react';
import { useOutletContext } from 'react-router';
import { supabase } from "../../lib/supabaseClient";

const Schedule = () => {
    const { isDark } = useOutletContext();

    // --- STATE ---
    const [userProfile, setUserProfile] = useState(null);
    const [platoonNode, setPlatoonNode] = useState(null);
    const [companySquads, setCompanySquads] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [isLessonsLoading, setIsLessonsLoading] = useState(false);

    const [formData, setFormData] = useState({
        team_id: '',
        start_time: '',
        end_time: '',
        room_type_needed: 'צוותי', // 'צוותי' | 'דוצ' | 'פלוגתי'
        needs_computers: false,
        notes: '',
        room_count: 1,
    });

    const isCompanySelected = formData.team_id === platoonNode?.id;
    const maxRooms = companySquads.length;

    // מיפוי בין ID של סוג חדר ב-DB לבין הטקסט ב-UI
    const roomTypeMapping = {
        1: 'צוותי',
        2: 'פלוגתי',
        3: 'דוצ'
    };

    const groupNames = useMemo(() => {
        const map = {};
        if (platoonNode) map[platoonNode.id] = platoonNode.name;
        companySquads.forEach(squad => { map[squad.id] = squad.name; });
        return map;
    }, [platoonNode, companySquads]);

    // --- LOGIC ---
    const findUserCompany = async (startGroupId) => {
        let currentGroupId = startGroupId;
        for (let i = 0; i < 10; i++) {
            if (!currentGroupId) return null;
            const { data: node } = await supabase.from('group_node').select('*').eq('id', currentGroupId).single();
            if (!node) return null;
            if (node.group_type_id === 3) return node;
            currentGroupId = node.parent_id;
        }
        return null;
    };

    const fetchCompanySquads = async (parentId) => {
        const { data } = await supabase.from('group_node').select('*').eq('parent_id', parentId);
        return data || [];
    };

    useEffect(() => {
        const initUser = async () => {
            setIsUserLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userData } = await supabase.from('users').select('*').eq('email', user.email).maybeSingle();
                if (userData) {
                    setUserProfile(userData);
                    const companyNode = await findUserCompany(userData.group_id);
                    setPlatoonNode(companyNode);
                    if (companyNode) {
                        const squads = await fetchCompanySquads(companyNode.id);
                        setCompanySquads(squads);
                    }
                }
            }
            setIsUserLoading(false);
        };
        initUser();
    }, []);

    useEffect(() => {
        const fetchLessons = async () => {
            setIsLessonsLoading(true);
            const { data } = await supabase.from('schedule_lessons').select('*').eq('date', selectedDate);
            setLessons(data || []);
            setIsLessonsLoading(false);
        };
        fetchLessons();
    }, [selectedDate]);

    const stats = useMemo(() => {
        const total = lessons.length;
        const assigned = lessons.filter(l => l.status === 2).length;
        const pending = lessons.filter(l => l.status === 1 || !l.status).length;
        return { total, assigned, pending };
    }, [lessons]);

    const handleSubmit = async () => {
        if (!formData.team_id || !formData.start_time || !formData.end_time) {
            alert('נא למלא את כל שדות החובה');
            return;
        }

        const roomTypeId = Object.keys(roomTypeMapping).find(key => roomTypeMapping[key] === formData.room_type_needed);

        const lessonData = {
            team_id: formData.team_id,
            date: selectedDate,
            start_time: formData.start_time,
            end_time: formData.end_time,
            needed_room_type_id: parseInt(roomTypeId),
            need_computer: formData.needs_computers,
            notes: formData.notes || null,
        };

        try {
            if (isCompanySelected && formData.room_count > 1) {
                const squadsToInsert = companySquads.slice(0, formData.room_count);
                const lessonsToInsert = squadsToInsert.map(squad => ({
                    ...lessonData,
                    team_id: squad.id,
                }));
                await supabase.from('schedule_lessons').insert(lessonsToInsert);
            } else {
                if (editingLesson) {
                    await supabase.from('schedule_lessons').update(lessonData).eq('id', editingLesson.id);
                } else {
                    await supabase.from('schedule_lessons').insert(lessonData);
                }
            }
            setShowModal(false);
            setEditingLesson(null);
            const { data } = await supabase.from('schedule_lessons').select('*').eq('date', selectedDate);
            setLessons(data || []);
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        if (window.confirm('למחוק את השיעור?')) {
            await supabase.from('schedule_lessons').delete().eq('id', id);
            setLessons(prev => prev.filter(l => l.id !== id));
        }
    };

    const getStatusChip = (status) => {
        const isAssigned = status === 2;
        return (
            <Chip
                icon={isAssigned ? <CheckCircle size={14} /> : <Clock size={14} />}
                label={isAssigned ? "שובץ" : "ממתין"}
                size="small"
                sx={{
                    flexDirection: 'row-reverse',
                    bgcolor: isAssigned ? '#d1fae5' : '#fef9c3',
                    color: isAssigned ? '#065f46' : '#854d0e',
                    fontWeight: 700,
                    borderRadius: '8px',
                    '& .MuiChip-icon': { mr: -0.5, ml: 0.5 }
                }}
            />
        );
    };

    const cellStyle = {
        color: isDark ? 'rgba(255,255,255,0.8)' : '#334155',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        py: 2,
        textAlign: 'right'
    };

    if (isUserLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

    return (
        <Container maxWidth="xl" sx={{ py: 6 }} dir="rtl">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Box sx={{ mb: 4, textAlign: 'right' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: isDark ? 'white' : '#1e293b', mb: 1 }}>
                        לוח הזמנים של {platoonNode?.name || 'הפלוגה'} 📅
                    </Typography>
                    <Typography sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b' }}>
                        הגש בקשות לשיבוץ חדרים והקצאת מפתחות
                    </Typography>
                </Box>
            </motion.div>

            {/* Toolbar */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 4,
                gap: 2,
                flexDirection: { xs: 'column', sm: 'row-reverse' }
            }}>
                <Button
                    variant="contained"
                    startIcon={<Plus size={20} />}
                    onClick={() => {
                        setEditingLesson(null);
                        setFormData({
                            team_id: '', start_time: '', end_time: '',
                            room_type_needed: 'צוותי', needs_computers: false,
                            notes: '', room_count: 1
                        });
                        setShowModal(true);
                    }}
                    sx={{
                        bgcolor: '#4f46e5',
                        borderRadius: '12px',
                        px: 3, py: 1.2,
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                        '&:hover': { bgcolor: '#4338ca' }
                    }}
                >
                    הוסף שיעור
                </Button>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1e293b' }}>
                        בחר תאריך:
                    </Typography>
                    <TextField
                        type="date"
                        size="small"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        sx={{
                            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            borderRadius: '12px',
                            '& .MuiOutlinedInput-root': { borderRadius: '12px' }
                        }}
                    />
                </Box>
            </Box>

            {/* Stats */}
            <Grid container spacing={3} sx={{ mb: 4 }} dir="rtl">
                {[
                    { label: 'סה"כ שיעורים', value: stats.total, color: '#4f46e5', bg: '#f5f3ff' },
                    { label: 'שובצו בהצלחה', value: stats.assigned, color: '#10b981', bg: '#ecfdf5' },
                    { label: 'ממתינים לשיבוץ', value: stats.pending, color: '#f59e0b', bg: '#fffbeb' },
                ].map((stat, i) => (
                    <Grid item xs={12} sm={4} key={i}>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <Card sx={{
                                p: 3, borderRadius: '24px', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : stat.bg,
                                border: `1px solid ${stat.color}20`, boxShadow: 'none', textAlign: 'right'
                            }}>
                                <Typography variant="caption" sx={{ color: stat.color, fontWeight: 800 }}>{stat.label}</Typography>
                                <Typography variant="h4" sx={{ color: isDark ? 'white' : '#1e293b', fontWeight: 800 }}>{stat.value}</Typography>
                            </Card>
                        </motion.div>
                    </Grid>
                ))}
            </Grid>

            {/* Table */}
            <TableContainer component={Paper} sx={{
                borderRadius: '24px',
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                boxShadow: 'none',
                overflow: 'hidden'
            }}>
                <Table dir="rtl">
                    <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                        <TableRow>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>צוות</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>זמן</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>סוג חדר</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>מחשב</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>סטטוס</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>שיבוץ</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>הערות</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>פעולות</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLessonsLoading ? (
                            <TableRow><TableCell colSpan={8} align="center" sx={{ py: 8 }}><CircularProgress size={24} /></TableCell></TableRow>
                        ) : lessons.length === 0 ? (
                            <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10, color: '#94a3b8' }}>אין שיעורים מתוכננים לתאריך זה</TableCell></TableRow>
                        ) : (
                            lessons.map((lesson) => (
                                <TableRow key={lesson.id} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f1f5f9' } }}>
                                    <TableCell align="right" sx={{ ...cellStyle, fontWeight: 700 }}>{groupNames[lesson.team_id] || 'לא ידוע'}</TableCell>
                                    <TableCell align="right" sx={{ ...cellStyle, fontFamily: 'monospace', direction: 'ltr' }}>
                                        {lesson.start_time?.slice(0, 5)} - {lesson.end_time?.slice(0, 5)}
                                    </TableCell>
                                    <TableCell align="right" sx={cellStyle}>
                                        <Chip 
                                            label={
                                                lesson.needed_room_type_id === 1 ? "🏠 צוותי" : 
                                                lesson.needed_room_type_id === 3 ? "👥 דו\"צ" : "🏢 פלוגתי"
                                            } 
                                            size="small" sx={{ borderRadius: '6px' }} 
                                        />
                                    </TableCell>
                                    <TableCell align="right" sx={cellStyle}>{lesson.need_computer ? '💻' : '-'}</TableCell>
                                    <TableCell align="right" sx={cellStyle}>{getStatusChip(lesson.status)}</TableCell>
                                    <TableCell align="right" sx={cellStyle}>
                                        {lesson.room_number ? (
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#e0e7ff', px: 1.5, py: 0.5, borderRadius: '8px', color: '#3730a3', fontWeight: 800 }}>
                                                <Key size={14} /> {lesson.room_number}
                                            </Box>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={cellStyle}>{lesson.notes || '-'}</TableCell>
                                    <TableCell align="center" sx={cellStyle}>
                                        <Stack direction="row" spacing={1} justifyContent="center">
                                            <IconButton size="small" onClick={() => {
                                                setEditingLesson(lesson);
                                                setFormData({
                                                    team_id: lesson.team_id || '',
                                                    start_time: lesson.start_time?.slice(0, 5) || '',
                                                    end_time: lesson.end_time?.slice(0, 5) || '',
                                                    room_type_needed: roomTypeMapping[lesson.needed_room_type_id] || 'צוותי',
                                                    needs_computers: lesson.need_computer || false,
                                                    notes: lesson.notes || '',
                                                    room_count: 1
                                                });
                                                setShowModal(true);
                                            }}>
                                                <Edit2 size={16} />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(lesson.id)}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Modal */}
            <Dialog
                open={showModal}
                onClose={() => setShowModal(false)}
                fullWidth maxWidth="xs"
                PaperProps={{ dir: 'rtl', sx: { borderRadius: '28px', p: 1 } }}
            >
                <DialogTitle>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ textAlign: 'right' }}>
                        <Calendar size={22} color="#4f46e5" />
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {editingLesson ? 'עדכון שיעור' : 'הוספת שיעור חדש'}
                        </Typography>
                    </Stack>
                </DialogTitle>

                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>עבור מי השיעור? *</Typography>
                            <Select
                                value={formData.team_id}
                                onChange={(e) => setFormData({ ...formData, team_id: e.target.value, room_count: 1 })}
                                sx={{ borderRadius: '12px', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}
                            >
                                {platoonNode && <MenuItem value={platoonNode.id} sx={{ justifyContent: 'flex-end' }}>{platoonNode.name} (כל הפלוגה) 🏢</MenuItem>}
                                {companySquads.map(squad => <MenuItem key={squad.id} value={squad.id} sx={{ justifyContent: 'flex-end' }}>{squad.name} 👥</MenuItem>)}
                            </Select>
                        </FormControl>

                        {isCompanySelected && (
                            <Box sx={{ p: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderRadius: '16px' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                                    כמות חדרים מבוקשת (מקסימום {maxRooms})
                                </Typography>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <IconButton size="small" onClick={() => setFormData(f => ({ ...f, room_count: Math.max(1, f.room_count - 1) }))}>
                                        <Minus size={18} />
                                    </IconButton>
                                    <Typography sx={{ fontWeight: 800 }}>{formData.room_count}</Typography>
                                    <IconButton size="small" onClick={() => setFormData(f => ({ ...f, room_count: Math.min(maxRooms, f.room_count + 1) }))}>
                                        <Plus size={18} />
                                    </IconButton>
                                </Stack>
                            </Box>
                        )}

                        <FormControl fullWidth>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>סוג חדר מבוקש *</Typography>
                            <Select
                                value={formData.room_type_needed}
                                onChange={(e) => setFormData({ ...formData, room_type_needed: e.target.value })}
                                sx={{ borderRadius: '12px', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}
                            >
                                <MenuItem value="צוותי" sx={{ justifyContent: 'flex-end' }}>🏠 חדר צוותי</MenuItem>
                                <MenuItem value="דוצ" sx={{ justifyContent: 'flex-end' }}>👥 חדר דו"צ</MenuItem>
                                <MenuItem value="פלוגתי" sx={{ justifyContent: 'flex-end' }}>🏢 חדר פלוגתי</MenuItem>
                            </Select>
                        </FormControl>

                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Stack direction="row-reverse" spacing={2}>
                                <TimePicker
                                    label="סיום" ampm={false}
                                    value={formData.end_time ? dayjs(formData.end_time, 'HH:mm') : null}
                                    onChange={(v) => setFormData({ ...formData, end_time: v?.format('HH:mm') })}
                                    slotProps={{ textField: { fullWidth: true, size: 'small', sx: { '& label': { left: 'auto', right: '28px' }, '& input': { textAlign: 'right' } } } }}
                                />
                                <TimePicker
                                    label="התחלה" ampm={false}
                                    value={formData.start_time ? dayjs(formData.start_time, 'HH:mm') : null}
                                    onChange={(v) => setFormData({ ...formData, start_time: v?.format('HH:mm') })}
                                    slotProps={{ textField: { fullWidth: true, size: 'small', sx: { '& label': { left: 'auto', right: '28px' }, '& input': { textAlign: 'right' } } } }}
                                />
                            </Stack>
                        </LocalizationProvider>

                        <FormControlLabel
                            sx={{ mr: 0, ml: 'auto' }}
                            control={<Checkbox checked={formData.needs_computers} onChange={e => setFormData({ ...formData, needs_computers: e.target.checked })} />}
                            label={<Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>דורש מחשב 🖥️</Typography>}
                        />

                        <TextField
                            placeholder="הערות מיוחדות..."
                            multiline rows={2}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            inputProps={{ dir: 'rtl' }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                        />
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ p: 3, gap: 1, flexDirection: 'row-reverse' }}>
                    <Button onClick={() => setShowModal(false)} variant="outlined" fullWidth sx={{ borderRadius: '12px', fontWeight: 700, color: '#64748b' }}>
                        ביטול
                    </Button>
                    <Button onClick={handleSubmit} variant="contained" fullWidth sx={{ borderRadius: '12px', fontWeight: 700, bgcolor: '#4f46e5' }}>
                        {editingLesson ? 'עדכן שיעור' : 'הוסף שיעור'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Schedule;