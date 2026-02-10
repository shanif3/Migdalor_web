import {
    Box, Button, Card, Container, Typography, Alert, CircularProgress, IconButton, Paper, Stack
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Send, Calendar, ChevronLeft, ChevronRight, Plus, Minus, RotateCcw, Save
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { supabase } from 'lib/supabaseClient';

export default function SubmitKeyRequest() {
    const { user, isDark } = useOutletContext();
    const [loading, setLoading] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [wednesdayOffset, setWednesdayOffset] = useState(0);
    const [existingRequestId, setExistingRequestId] = useState(null);

    const [formData, setFormData] = useState({
        single_team_amount: 0,
        two_team_amount: 0,
        company_amount: 0,
        range_start: '',
        range_end: ''
    });

    const THEME_COLOR = '#10b981'; 
    const UPDATE_COLOR = '#3b82f6';

    const getNextWednesday = (weeks) => {
        const d = new Date();
        d.setDate(d.getDate() + (14 + (weeks * 7)));
        d.setDate(d.getDate() + (3 - d.getDay() + 7) % 7 || 7);
        return d;
    };

    const fetchExistingRequest = useCallback(async (date) => {
        if (!user?.group_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('keys_request')
                .select('id, single_team_amount, two_team_amount, company_amount')
                .eq('requester', user.group_id)
                .eq('range_start', date)
                .eq('status', 'pending')
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setExistingRequestId(data.id);
                setFormData(prev => ({
                    ...prev,
                    single_team_amount: data.single_team_amount,
                    two_team_amount: data.two_team_amount,
                    company_amount: data.company_amount
                }));
            } else {
                setExistingRequestId(null);
                setFormData(prev => ({
                    ...prev,
                    single_team_amount: 0,
                    two_team_amount: 0,
                    company_amount: 0
                }));
            }
        } catch (err) {
            console.error("Error fetching request:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.group_id]);

    useEffect(() => {
        const targetWednesday = getNextWednesday(wednesdayOffset);
        const dateStr = targetWednesday.toISOString().split('T')[0];
        
        // איפוס הודעות במעבר בין שבועות
        setSubmitSuccess(false);
        setError(null);
        
        setFormData(prev => ({ ...prev, range_start: dateStr, range_end: dateStr }));
        fetchExistingRequest(dateStr);
    }, [wednesdayOffset, fetchExistingRequest]);

    const handleOffsetChange = (delta) => {
        if (delta < 0 && wednesdayOffset === 0) return;
        setWednesdayOffset(prev => prev + delta);
    };

    const fetchAncestorGroup = async (startGroupId, targetTypeName) => {
        const { data } = await supabase.rpc('get_parent_group_by_type', {
            start_group_id: startGroupId,
            target_type_name: targetTypeName
        });
        return data?.[0] || null;
    };

    const updateAmount = (field, delta) => {
        setFormData(prev => ({
            ...prev,
            [field]: Math.max(0, prev[field] + delta)
        }));
        setSubmitSuccess(false); // ברגע שמשנים ערך, הודעת ההצלחה הקודמת נעלמת
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSubmitSuccess(false);

        try {
            const totalRooms = formData.single_team_amount + formData.two_team_amount + formData.company_amount;
            if (totalRooms === 0) throw new Error('יש לבקש לפחות כיתה אחת');

            const battalionGroup = await fetchAncestorGroup(user.group_id, 'Battalion');
            const requesteeId = battalionGroup ? battalionGroup.id : user.group_id;

            const payload = {
                requester: user.group_id,
                requestee: requesteeId,
                single_team_amount: formData.single_team_amount,
                two_team_amount: formData.two_team_amount,
                company_amount: formData.company_amount,
                range_start: formData.range_start,
                range_end: formData.range_end,
                status: 'pending'
            };

            let res;
            if (existingRequestId) {
                res = await supabase.from('keys_request').update(payload).eq('id', existingRequestId);
            } else {
                res = await supabase.from('keys_request').insert(payload).select('id').single();
                if (res.data) setExistingRequestId(res.data.id);
            }

            if (res.error) throw res.error;
            setSubmitSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const totalRooms = formData.single_team_amount + formData.two_team_amount + formData.company_amount;

    const InputRow = ({ label, field }) => (
        <Paper elevation={0} sx={{
            p: 2.5, borderRadius: '24px', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fcfcfd',
            border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '0.2s',
            '&:hover': { borderColor: existingRequestId ? UPDATE_COLOR : THEME_COLOR }
        }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{label}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                <IconButton onClick={() => updateAmount(field, -1)} sx={{ border: '2px solid', borderColor: 'divider', width: 42, height: 42 }}>
                    <Minus size={20} />
                </IconButton>
                <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, minWidth: '40px', textAlign: 'center' }}>{formData[field]}</Typography>
                <IconButton 
                    onClick={() => updateAmount(field, 1)}
                    sx={{ bgcolor: existingRequestId ? UPDATE_COLOR : THEME_COLOR, color: 'white', width: 42, height: 42, '&:hover': { opacity: 0.9 } }}
                >
                    <Plus size={20} />
                </IconButton>
            </Box>
        </Paper>
    );

    return (
        <Container maxWidth="sm" sx={{ py: 6, direction: 'rtl' }}>
            <Box sx={{ textAlign: 'center', mb: 5 }}>
                <Typography variant="h3" sx={{ fontWeight: 950, mb: 1 }}>בקשת מפתחות</Typography>
                <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {existingRequestId ? 'עריכת בקשה קיימת' : 'הגשת בקשה חדשה'}
                </Typography>
            </Box>

            <Box sx={{ position: 'relative', mb: 7 }}>
                <Card sx={{ 
                    p: 1.5, borderRadius: '24px', display: 'flex', alignItems: 'center', 
                    justifyContent: 'space-between', bgcolor: isDark ? '#1a1a2e' : '#f8fafc', 
                    border: '1px solid', borderColor: existingRequestId ? UPDATE_COLOR : THEME_COLOR,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                }}>
                    <IconButton onClick={() => handleOffsetChange(-1)} disabled={wednesdayOffset === 0}>
                        <ChevronRight size={28} />
                    </IconButton>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: existingRequestId ? UPDATE_COLOR : THEME_COLOR, display: 'block', mb: 0.5 }}>יום רביעי</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            {new Date(formData.range_start).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Typography>
                    </Box>
                    <IconButton onClick={() => handleOffsetChange(1)} sx={{ color: existingRequestId ? UPDATE_COLOR : THEME_COLOR }}>
                        <ChevronLeft size={28} />
                    </IconButton>
                </Card>
            </Box>

            <Stack spacing={2.5} sx={{ mb: 6 }}>
                <InputRow label="כיתות צוותיות" field="single_team_amount" />
                <InputRow label="כיתות דו-צוותיות" field="two_team_amount" />
                <InputRow label="כיתות פלוגתיות" field="company_amount" />
            </Stack>

            <Box sx={{ textAlign: 'center', mb: 6 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>סה"כ מפתחות לשריון</Typography>
                <Typography variant="h2" sx={{ fontWeight: 650, color: totalRooms > 0 ? (existingRequestId ? UPDATE_COLOR : THEME_COLOR) : 'divider', lineHeight: 0.8 }}>
                    {totalRooms}
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '16px' }}>{error}</Alert>}
            
            <AnimatePresence>
                {submitSuccess && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Alert severity="success" sx={{ mb: 3, borderRadius: '16px', bgcolor: existingRequestId ? UPDATE_COLOR : THEME_COLOR, color: 'white' }}>
                            {existingRequestId ? 'הבקשה עודכנה בהצלחה!' : 'הבקשה נשלחה בהצלחה!'}
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                fullWidth variant="contained" disabled={loading || totalRooms === 0}
                onClick={handleSubmit}
                startIcon={existingRequestId ? <Save size={20} /> : <Send size={20} />}
                sx={{
                    py: 2.0, borderRadius: '24px', fontSize: '1.25rem', fontWeight: 700,
                    background: existingRequestId ? `linear-gradient(135deg, ${UPDATE_COLOR} 0%, #2563eb 100%)` : `linear-gradient(135deg, ${THEME_COLOR} 0%, #059669 100%)`,
                    boxShadow: existingRequestId ? `0 12px 30px rgba(59, 130, 246, 0.3)` : `0 12px 30px ${THEME_COLOR}40`,
                }}
            >
                {loading ? <CircularProgress size={28} color="inherit" /> : (existingRequestId ? 'עדכן בקשה' : 'שלח בקשה')}
            </Button>
        </Container>
    );
}