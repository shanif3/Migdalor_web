import {
  Box, Button, Card, Container, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Chip, CircularProgress, Paper, IconButton as MuiIconButton, TextField, Alert, Snackbar, Stack, Tooltip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import {
  Key, CheckCircle, Clock, Calendar, ChevronLeft, ChevronRight, ShieldAlert, RotateCcw, Pencil, Save, X, Trash2, Plus, Minus, AlertTriangle
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { BAHAD_GROUP_KEY_ID } from 'lib/consts';
import { supabase } from 'lib/supabaseClient';

// רכיב דיאלוג אישור מעוצב
const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, confirmText = "אשר", isDestructive = false }) => (
  <Dialog open={open} onClose={onCancel} dir="rtl" PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
      <AlertTriangle color={isDestructive ? '#ef4444' : '#10b981'} size={24} />
      {title}
    </DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ fontWeight: 500 }}>{message}</DialogContentText>
    </DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}>
      <Button onClick={onCancel} sx={{ borderRadius: '12px', fontWeight: 700 }}>ביטול</Button>
      <Button 
        onClick={onConfirm} 
        variant="contained" 
        sx={{ 
          borderRadius: '12px', fontWeight: 700, 
          bgcolor: isDestructive ? '#ef4444' : '#10b981',
          '&:hover': { bgcolor: isDestructive ? '#dc2626' : '#059669' }
        }}
      >
        {confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

export default function KeyRequestsPage() {
  const { isDark } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [selectedWednesday, setSelectedWednesday] = useState('');
  const [wednesdayOffset, setWednesdayOffset] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // State לדיאלוג האישור
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, isDestructive: false });

  const THEME_COLOR = '#10b981';
  const UPDATE_COLOR = '#3b82f6';
  const ALERT_COLOR = '#ef4444';

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('keys_request')
      .select('*, requestee (id, name)')
      .order('range_start', { ascending: true });

    if (!error) {
      const requestsWithBattalion = await Promise.all(
        data.map(async (req) => {
          const { data: battalionData } = await supabase.rpc('get_parent_group_by_type', {
            start_group_id: req.requestee.id,
            target_type_name: 'Battalion',
          });
          return { ...req, battalion_name: battalionData?.[0]?.name || 'N/A' };
        })
      );
      setRequests(requestsWithBattalion);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const targetWednesday = getNextWednesday(wednesdayOffset);
    setSelectedWednesday(targetWednesday.toISOString().split('T')[0]);
  }, [wednesdayOffset]);

  const getNextWednesday = (weeks) => {
    const d = new Date();
    d.setDate(d.getDate() + (14 + (weeks * 7)));
    d.setDate(d.getDate() + (3 - d.getDay() + 7) % 7 || 7);
    return d;
  };

  const handleEditClick = (req) => {
    setEditingId(req.id);
    setEditValues({
      single_team_amount: req.single_team_amount,
      two_team_amount: req.two_team_amount,
      company_amount: req.company_amount
    });
  };

  const handleSaveEdit = async (id) => {
    const req = requests.find(r => r.id === id);
    
    if (req.status === 'pending') {
      // אם הבקשה ממתינה - רק נעדכן את הכמויות
      const { error } = await supabase
        .from('keys_request')
        .update(editValues)
        .eq('id', id);

      if (!error) {
        setNotification({ open: true, message: 'הבקשה עודכנה בהצלחה', severity: 'success' });
        setEditingId(null);
        fetchRequests();
      }
    } else {
      // אם הבקשה אושרה - נעדכן את החלוקה בפועל
      await updateApprovedRequest(req);
    }
  };

const updateApprovedRequest = async (req) => {
  setLoading(true);
  try {
    const targetGroupId = req.requestee.id;

    // חישוב ההפרש
    const oldSmall = req.single_team_amount;
    const oldDotz = req.two_team_amount;
    const oldLarge = req.company_amount;

    const newSmall = editValues.single_team_amount;
    const newDotz = editValues.two_team_amount;
    const newLarge = editValues.company_amount;

    const diffSmall = newSmall - oldSmall;
    const diffDotz = newDotz - oldDotz;
    const diffLarge = newLarge - oldLarge;

    // קבלת מפתחות זמינים (שלא משובצים לשבוע זה)
    const { data: assignedThisWeek } = await supabase
      .from('key_assignments')
      .select('key_id')
      .eq('assigned_at', selectedWednesday); // שינוי: לפי assigned_at במקום request_id
    
    const assignedKeyIds = new Set(assignedThisWeek?.map(a => a.key_id) || []);

    const { data: allKeys } = await supabase
      .from('keysmanager_keys')
      .select('*');

    const availableKeys = allKeys?.filter(k => !assignedKeyIds.has(k.id)) || [];
    
    // קבלת המפתחות המשובצים לבקשה הזו בשבוע הזה
    const { data: thisRequestAssignments } = await supabase
      .from('key_assignments')
      .select('key_id')
      .eq('request_id', req.id)
      .eq('assigned_at', selectedWednesday); // שינוי: גם לפי assigned_at
    
    const thisRequestKeyIds = new Set(thisRequestAssignments?.map(a => a.key_id) || []);
    const assignedKeys = allKeys?.filter(k => thisRequestKeyIds.has(k.id)) || [];

    let smallAvailable = availableKeys.filter(k => k.room_type_id === 1);
    let dotzAvailable = availableKeys.filter(k => k.room_type_id === 3);
    let largeAvailable = availableKeys.filter(k => k.room_type_id === 2);

    let smallAssigned = assignedKeys.filter(k => k.room_type_id === 1);
    let dotzAssigned = assignedKeys.filter(k => k.room_type_id === 3);
    let largeAssigned = assignedKeys.filter(k => k.room_type_id === 2);

    let finalSmall = req.assigned_small_rooms;
    let finalDotz = req.assigned_dotz_rooms;
    let finalLarge = req.assigned_large_rooms;

    // טיפול בחדרים צוותיים
    if (diffSmall > 0) {
      // צריך להוסיף מפתחות
      for (let i = 0; i < diffSmall && smallAvailable.length > 0; i++) {
        const key = smallAvailable.shift();
        await supabase
          .from('key_assignments')
          .insert({ 
            key_id: key.id, 
            request_id: req.id, 
            assigned_at: selectedWednesday  // שינוי: התאריך של השבוע
          });
        finalSmall++;
      }
    } else if (diffSmall < 0) {
      // צריך להחזיר מפתחות
      const toReturn = Math.min(Math.abs(diffSmall), smallAssigned.length);
      for (let i = 0; i < toReturn; i++) {
        const key = smallAssigned.shift();
        await supabase
          .from('key_assignments')
          .delete()
          .eq('key_id', key.id)
          .eq('request_id', req.id)
          .eq('assigned_at', selectedWednesday); // שינוי: גם לפי assigned_at
        finalSmall--;
      }
    }

    // טיפול בחדרי דו"צ
    if (diffDotz > 0) {
      for (let i = 0; i < diffDotz && dotzAvailable.length > 0; i++) {
        const key = dotzAvailable.shift();
        await supabase
          .from('key_assignments')
          .insert({ 
            key_id: key.id, 
            request_id: req.id, 
            assigned_at: selectedWednesday  // שינוי: התאריך של השבוע
          });
        finalDotz++;
      }
    } else if (diffDotz < 0) {
      const toReturn = Math.min(Math.abs(diffDotz), dotzAssigned.length);
      for (let i = 0; i < toReturn; i++) {
        const key = dotzAssigned.shift();
        await supabase
          .from('key_assignments')
          .delete()
          .eq('key_id', key.id)
          .eq('request_id', req.id)
          .eq('assigned_at', selectedWednesday); // שינוי: גם לפי assigned_at
        finalDotz--;
      }
    }

    // טיפול בחדרים פלוגתיים
    if (diffLarge > 0) {
      for (let i = 0; i < diffLarge && largeAvailable.length > 0; i++) {
        const key = largeAvailable.shift();
        await supabase
          .from('key_assignments')
          .insert({ 
            key_id: key.id, 
            request_id: req.id, 
            assigned_at: selectedWednesday  // שינוי: התאריך של השבוע
          });
        finalLarge++;
      }
    } else if (diffLarge < 0) {
      const toReturn = Math.min(Math.abs(diffLarge), largeAssigned.length);
      for (let i = 0; i < toReturn; i++) {
        const key = largeAssigned.shift();
        await supabase
          .from('key_assignments')
          .delete()
          .eq('key_id', key.id)
          .eq('request_id', req.id)
          .eq('assigned_at', selectedWednesday); // שינוי: גם לפי assigned_at
        finalLarge--;
      }
    }

    // עדכון הבקשה
    const totalRequested = newSmall + newDotz + newLarge;
    const totalAssigned = finalSmall + finalDotz + finalLarge;

    await supabase
      .from('keys_request')
      .update({
        single_team_amount: newSmall,
        two_team_amount: newDotz,
        company_amount: newLarge,
        assigned_small_rooms: finalSmall,
        assigned_dotz_rooms: finalDotz,
        assigned_large_rooms: finalLarge,
        missing_rooms: totalRequested - totalAssigned
      })
      .eq('id', req.id);

    setNotification({ 
      open: true, 
      message: 'החלוקה עודכנה בהצלחה', 
      severity: 'success' 
    });
    setEditingId(null);
    fetchRequests();
  } catch (err) {
    setNotification({ 
      open: true, 
      message: 'שגיאה בעדכון החלוקה', 
      severity: 'error' 
    });
  } finally {
    setLoading(false);
  }
};
  // פונקציה למחיקת בקשה
  const handleDeleteRequest = async (req) => {
    setLoading(true);
    try {
      // אם הבקשה כבר אושרה, נמחק את השיוכים מ-key_assignments
      if (req.status === 'approved') {
        await supabase
          .from('key_assignments')
          .delete()
          .eq('request_id', req.id);
      }
      
      const { error } = await supabase
        .from('keys_request')
        .delete()
        .eq('id', req.id);

      if (error) throw error;

      setNotification({ 
        open: true, 
        message: req.status === 'approved' 
          ? 'הבקשה נמחקה והמפתחות שוחררו' 
          : 'הבקשה נמחקה בהצלחה', 
        severity: 'success' 
      });
      fetchRequests();
    } catch (err) {
      setNotification({ 
        open: true, 
        message: 'שגיאה במחיקת הבקשה', 
        severity: 'error' 
      });
    } finally {
      setConfirmState({ ...confirmState, open: false });
      setLoading(false);
    }
  };

const resetDistribution = async (requestList) => {
  try {
    for (const req of requestList) {
      // מחיקת כל השיוכים של הבקשה (לפי assigned_at)
      const { error: deleteError } = await supabase
        .from('key_assignments')
        .delete()
        .eq('request_id', req.id)
        .eq('assigned_at', selectedWednesday); // שינוי: גם לפי השבוע
      
      if (deleteError) {
        console.error('Error deleting assignments:', deleteError);
        return false;
      }
      
      // איפוס הבקשה
      const { error: requestError } = await supabase
        .from('keys_request')
        .update({
          status: 'pending', 
          assigned_small_rooms: 0, 
          assigned_dotz_rooms: 0, 
          assigned_large_rooms: 0, 
          missing_rooms: 0
        })
        .eq('id', req.id);
      
      if (requestError) {
        console.error('Error resetting request:', requestError);
        return false;
      }
    }
    return true;
  } catch (err) { 
    console.error('Reset distribution error:', err);
    return false; 
  }
};

const processDistribution = async (pendingList) => {
  const { data: allKeys, error: fetchError } = await supabase
    .from('keysmanager_keys')
    .select('*');

  if (fetchError) {
    console.error('Error fetching keys:', fetchError);
    setNotification({ open: true, message: 'שגיאה בטעינת מפתחות', severity: 'error' });
    setLoading(false);
    return 0;
  }

  if (!allKeys || allKeys.length === 0) {
    setNotification({ open: true, message: 'אין מפתחות זמינים', severity: 'warning' });
    setLoading(false);
    return 0;
  }

  // קבלת כל הבקשות המאושרות לשבוע זה
  const { data: weekApprovedRequests } = await supabase
    .from('keys_request')
    .select('id')
    .eq('range_start', selectedWednesday)
    .eq('status', 'approved');

  const approvedRequestIds = weekApprovedRequests?.map(r => r.id) || [];

  // קבלת כל השיוכים הקיימים לשבוע זה (לפי assigned_at)
  const { data: existingAssignments } = await supabase
    .from('key_assignments')
    .select('key_id')
    .eq('assigned_at', selectedWednesday); // שינוי: לפי assigned_at במקום request_id

  const assignedKeyIds = new Set(existingAssignments?.map(a => a.key_id) || []);
  const availableKeys = allKeys.filter(k => !assignedKeyIds.has(k.id));

  console.log('Total keys:', allKeys.length);
  console.log('Assigned keys this week:', assignedKeyIds.size);
  console.log('Available keys:', availableKeys.length);

  let smallKeys = availableKeys.filter(k => k.room_type_id === 1);
  let dotzKeys = availableKeys.filter(k => k.room_type_id === 3);
  let largeKeys = availableKeys.filter(k => k.room_type_id === 2);

  console.log('Available by type:', {
    small: smallKeys.length,
    dotz: dotzKeys.length,
    large: largeKeys.length
  });

  const requestUpdates = [];

  for (const req of pendingList) {
    const needsSmall = req.single_team_amount || 0;
    const needsDotz = req.two_team_amount || 0;
    const needsLarge = req.company_amount || 0;

    console.log(`Request ${req.id} needs:`, { small: needsSmall, dotz: needsDotz, large: needsLarge });

    let assignedSmall = 0, assignedLarge = 0, assignedDotz = 0;

    // חלוקת מפתחות צוותיים
    for (let i = 0; i < needsSmall && smallKeys.length > 0; i++) {
      const key = smallKeys.shift();
      console.log('Assigning small key:', key.id);
      const { error } = await supabase
        .from('key_assignments')
        .insert({ 
          key_id: key.id, 
          request_id: req.id, 
          assigned_at: selectedWednesday  // שינוי: התאריך של השבוע
        });
      
      if (error) {
        console.error('Error assigning key:', error);
      } else {
        assignedSmall++;
        assignedKeyIds.add(key.id);
      }
    }

    // חלוקת מפתחות דו"צ
    for (let i = 0; i < needsDotz && dotzKeys.length > 0; i++) {
      const key = dotzKeys.shift();
      console.log('Assigning dotz key:', key.id);
      const { error } = await supabase
        .from('key_assignments')
        .insert({ 
          key_id: key.id, 
          request_id: req.id, 
          assigned_at: selectedWednesday  // שינוי: התאריך של השבוע
        });
      
      if (error) {
        console.error('Error assigning key:', error);
      } else {
        assignedDotz++;
        assignedKeyIds.add(key.id);
      }
    }

    // חלוקת מפתחות פלוגתיים
    for (let i = 0; i < needsLarge && largeKeys.length > 0; i++) {
      const key = largeKeys.shift();
      console.log('Assigning large key:', key.id);
      const { error } = await supabase
        .from('key_assignments')
        .insert({ 
          key_id: key.id, 
          request_id: req.id, 
          assigned_at: selectedWednesday  // שינוי: התאריך של השבוע
        });
      
      if (error) {
        console.error('Error assigning key:', error);
      } else {
        assignedLarge++;
        assignedKeyIds.add(key.id);
      }
    }

    console.log(`Assigned to request ${req.id}:`, { small: assignedSmall, dotz: assignedDotz, large: assignedLarge });

    requestUpdates.push({
      id: req.id,
      status: 'approved',
      assigned_small_rooms: assignedSmall,
      assigned_dotz_rooms: assignedDotz,
      assigned_large_rooms: assignedLarge,
      missing_rooms: (needsSmall + needsDotz + needsLarge) - (assignedSmall + assignedDotz + assignedLarge)
    });
  }

  // עדכון הבקשות
  for (const reqUpdate of requestUpdates) {
    await supabase.from('keys_request').update(reqUpdate).eq('id', reqUpdate.id);
  }

  const totalAssigned = requestUpdates.reduce((sum, r) => sum + r.assigned_small_rooms + r.assigned_dotz_rooms + r.assigned_large_rooms, 0);
  
  console.log('Total assigned:', totalAssigned);

  setNotification({ 
    open: true, 
    message: `חולקו ${totalAssigned} מפתחות בהצלחה`, 
    severity: 'success' 
  });

  setLoading(false);
  return requestUpdates.length;
};
  const filteredRequests = requests.filter(req => req.range_start === selectedWednesday);

  const EditableCell = ({ value, field, req }) => {
    const isEditing = editingId === req.id;
    let assigned = field === 'single_team_amount' ? req.assigned_small_rooms : field === 'two_team_amount' ? req.assigned_dotz_rooms : req.assigned_large_rooms;

    const adjustValue = (delta) => {
        const newVal = Math.max(0, (editValues[field] || 0) + delta);
        setEditValues({ ...editValues, [field]: newVal });
    };

    if (isEditing) {
      return (
        <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="center">
          <MuiIconButton size="small" onClick={() => adjustValue(-1)} sx={{ color: THEME_COLOR, p: 0.5 }}>
            <Minus size={16} />
          </MuiIconButton>
          <TextField
            size="small" type="number" variant="standard"
            value={editValues[field]}
            onChange={(e) => setEditValues({ ...editValues, [field]: Math.max(0, parseInt(e.target.value) || 0) })}
            inputProps={{ style: { textAlign: 'left', fontWeight: 800, width: '40px' } }}
          />
          <MuiIconButton size="small" onClick={() => adjustValue(+1)} sx={{ color: ALERT_COLOR, p: 0.5 }}>
            <Plus size={16} />
          </MuiIconButton>
        </Stack>
      );
    }
    return (
      <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
        <span style={{ color: THEME_COLOR }}>{assigned || 0}</span>/{value}
      </Typography>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6, direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <ConfirmDialog 
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ ...confirmState, open: false })}
      />

      <Snackbar open={notification.open} autoHideDuration={4000} onClose={() => setNotification({ ...notification, open: false })} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={notification.severity} variant="filled" sx={{ borderRadius: '16px', fontWeight: 600 }}>{notification.message}</Alert>
      </Snackbar>

      <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 950, mb: 1 }}>ניהול בקשות</Typography>
          <Typography sx={{ color: 'text.secondary', fontWeight: 500 }}>חלוקת מפתחות ועריכת דרישות גדודים</Typography>
      </Box>

      {/* Date Navigator */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', mb: 6 }}>
        <Box sx={{ position: 'relative', width: '100%', maxWidth: 500, mb: 8 }}>
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: '24px', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: '1px solid', borderColor: THEME_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <MuiIconButton onClick={() => wednesdayOffset > 0 && setWednesdayOffset(prev => prev - 1)} disabled={wednesdayOffset === 0}><ChevronRight size={28} /></MuiIconButton>
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: THEME_COLOR, display: 'block', mb: 0.5 }}>יום רביעי</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{selectedWednesday && new Date(selectedWednesday).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
            </Box>
            <MuiIconButton onClick={() => setWednesdayOffset(prev => prev + 1)} sx={{ color: THEME_COLOR, bgcolor: `${THEME_COLOR}10` }}><ChevronLeft size={28} /></MuiIconButton>
          </Paper>
          <AnimatePresence>
            {wednesdayOffset > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'absolute', bottom: -45, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => setWednesdayOffset(0)} sx={{ color: THEME_COLOR, fontWeight: 800, fontSize: '0.85rem' }}> חזור לרביעי הנוכחי </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        <Stack direction="row" spacing={2}>
            <Button onClick={async () => { setLoading(true); await processDistribution(filteredRequests.filter(r => r.status === 'pending')); fetchRequests(); }} disabled={loading || filteredRequests.length === 0} variant="contained" sx={{ py: 2, px: 6, borderRadius: '20px', fontSize: '1.1rem', fontWeight: 900, background: `linear-gradient(135deg, ${THEME_COLOR} 0%, #059669 100%)`, boxShadow: `0 12px 24px ${THEME_COLOR}30` }}>
                {loading ? <CircularProgress size={26} color="inherit" /> : 'חלק באופן שווה ואשר הכל'}
            </Button>
            <Button 
                onClick={() => setConfirmState({
                    open: true,
                    title: "איפוס חלוקה שבועי",
                    message: "האם אתה בטוח שברצונך לאפס את כל החלוקה לשבוע זה? המפתחות ישוחררו.",
                    isDestructive: true,
                    onConfirm: async () => {
                        setLoading(true);
                        const success = await resetDistribution(filteredRequests.filter(r => r.status === 'approved'));
                        if (success) {
                          setNotification({ open: true, message: 'החלוקה אופסה והמפתחות שוחררו', severity: 'success' });
                        } else {
                          setNotification({ open: true, message: 'שגיאה באיפוס החלוקה', severity: 'error' });
                        }
                        fetchRequests();
                        setConfirmState({ ...confirmState, open: false });
                    }
                })}
                disabled={loading || !filteredRequests.some(r => r.status === 'approved')} 
                variant="outlined" color="error" startIcon={<Trash2 size={20} />} 
                sx={{ py: 2, px: 4, borderRadius: '20px', fontWeight: 800, border: '2px solid' }}
            > 
                איפוס חלוקה 
            </Button>
        </Stack>
      </Box>

      <TableContainer component={Paper} sx={{ width: '100%', borderRadius: '28px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc' }}>
              <TableCell align="right" sx={{ fontWeight: 800, py: 3 }}>מבקש (גדוד)</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>צוותי</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>דו״צ</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>פלוגתי</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>חסרים</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>סטטוס</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>פעולות</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRequests.map((req) => (
              <TableRow key={req.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{req.battalion_name}</TableCell>
                <TableCell align="center"><EditableCell value={req.single_team_amount} field="single_team_amount" req={req} /></TableCell>
                <TableCell align="center"><EditableCell value={req.two_team_amount} field="two_team_amount" req={req} /></TableCell>
                <TableCell align="center"><EditableCell value={req.company_amount} field="company_amount" req={req} /></TableCell>
                <TableCell align="center">
                  {req.missing_rooms > 0 ? <Chip label={req.missing_rooms} size="small" sx={{ bgcolor: 'rgba(239, 68, 68, 0.1)', color: ALERT_COLOR, fontWeight: 900, borderRadius: '8px' }} /> : <Typography sx={{ color: '#94a3b8' }}>-</Typography>}
                </TableCell>
                <TableCell align="center">
                  <Chip label={req.status === 'pending' ? 'ממתין' : 'אושר'} icon={req.status === 'pending' ? <Clock size={14}/> : <CheckCircle size={14}/>} sx={{ fontWeight: 800, borderRadius: '12px', bgcolor: req.status === 'pending' ? 'rgba(251, 146, 60, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: req.status === 'pending' ? '#fb923c' : '#10b981' }} />
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    {editingId === req.id ? (
                      <><MuiIconButton onClick={() => handleSaveEdit(req.id)} size="small" sx={{ color: THEME_COLOR }}><Save size={20} /></MuiIconButton><MuiIconButton onClick={() => setEditingId(null)} size="small" sx={{ color: ALERT_COLOR }}><X size={20} /></MuiIconButton></>
                    ) : (
                      <>
                        <Tooltip title="ערוך"><MuiIconButton onClick={() => handleEditClick(req)} size="small" sx={{ color: UPDATE_COLOR }}><Pencil size={18} /></MuiIconButton></Tooltip>
                        
                        {/* כפתור מחיקה */}
                        <Tooltip title="מחק בקשה">
                          <MuiIconButton 
                            onClick={() => setConfirmState({
                              open: true,
                              title: "מחיקת בקשה",
                              message: req.status === 'approved' 
                                ? `האם אתה בטוח שברצונך למחוק את הבקשה של גדוד ${req.battalion_name}? כל המפתחות שהוקצו ישוחררו. פעולה זו אינה הפיכה.`
                                : `האם אתה בטוח שברצונך למחוק את הבקשה של גדוד ${req.battalion_name}? פעולה זו אינה הפיכה.`,
                              isDestructive: true,
                              onConfirm: () => handleDeleteRequest(req)
                            })} 
                            size="small" 
                            sx={{ color: ALERT_COLOR }}
                          >
                            <Trash2 size={18} />
                          </MuiIconButton>
                        </Tooltip>

                        {req.status === 'pending' ? (
                            <Tooltip title="הקצאה אישית"><MuiIconButton onClick={async () => { setLoading(true); await processDistribution([req]); fetchRequests(); }} size="small" sx={{ color: THEME_COLOR }}><PublishedWithChangesIcon size={18} /></MuiIconButton></Tooltip>
                        ) : (
                            <Tooltip title="איפוס">
                                <MuiIconButton onClick={() => setConfirmState({
                                    open: true,
                                    title: "ביטול הקצאה גדודית",
                                    message: `האם לבטל את ההקצאה עבור גדוד ${req.battalion_name}? המפתחות ישוחררו והבקשה תעבור למצב ממתין.`,
                                    isDestructive: false,
                                    onConfirm: async () => {
                                        setLoading(true);
                                        const success = await resetDistribution([req]);
                                        if (success) {
                                          setNotification({ open: true, message: 'ההקצאה בוטלה והמפתחות שוחררו', severity: 'success' });
                                        } else {
                                          setNotification({ open: true, message: 'שגיאה בביטול ההקצאה', severity: 'error' });
                                        }
                                        fetchRequests();
                                        setConfirmState({ ...confirmState, open: false });
                                    }
                                })} size="small" sx={{ color: ALERT_COLOR }}><RotateCcw size={18} /></MuiIconButton>
                            </Tooltip>
                        )}
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}