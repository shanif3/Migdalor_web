import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Card,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  IconButton,
  Grid,
  Container,
  Paper,
  TableContainer,
  CircularProgress,
  Alert,
  Fade,
  Tooltip
} from "@mui/material";
import { motion } from "framer-motion";
import {
  Wand2,
  Calendar,
  Key,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Shield,
  Computer,
  Building,
  Home,
  Briefcase
} from "lucide-react";
import { useOutletContext, useNavigate } from "react-router";
import { supabase } from "../../lib/supabaseClient";

const KeysAllocator = () => {
  const { user, isDark } = useOutletContext();

  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = localStorage.getItem("keysAllocatorDate");
    return savedDate || new Date().toISOString().split("T")[0];
  });
  const navigate = useNavigate();

  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allKeys, setAllKeys] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [userGdudId, setUserGdudId] = useState(null);

  // בדיקת הרשאות מעודכנת
  const isAdmin = user?.roles?.includes("מנהל") || user?.roles?.includes("קה״ד גדודי בהתנסות");

  // מציאת יום רביעי הרלוונטי לשבוע של התאריך הנבחר (לצורך סינון המפתחות המשויכים)
  const getRelevantWednesday = (dateString) => {
    const d = new Date(dateString);
    const day = d.getDay();
    const diff = d.getDate() - day + (day <= 3 ? -4 : 3); // מוצא את יום רביעי של אותו שבוע
    const wed = new Date(d.setDate(diff));
    return wed.toISOString().split('T')[0];
  };

  const findUserGdud = async (groupId) => {
    let currentId = groupId;
    while (currentId) {
      const { data, error } = await supabase
        .from("group_node")
        .select("id, parent_id, group_type_id")
        .eq("id", currentId)
        .single();
      if (error || !data) break;
      if (data.group_type_id === 2) return data.id;
      currentId = data.parent_id;
    }
    return groupId;
  };

  useEffect(() => {
    const initUserGdud = async () => {
      if (user?.group_id) {
        const gdudId = await findUserGdud(user.group_id);
        setUserGdudId(gdudId);
      }
    };
    initUserGdud();
  }, [user]);

  const isLessonInUserGdud = async (groupId) => {
    if (!userGdudId || !groupId) return false;
    let currentId = groupId;
    while (currentId) {
      if (currentId === userGdudId) return true;
      const { data, error } = await supabase.from("group_node").select("parent_id").eq("id", currentId).single();
      if (error || !data) break;
      currentId = data.parent_id;
    }
    return false;
  };

  useEffect(() => {
    localStorage.setItem("keysAllocatorDate", selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const relevantWed = getRelevantWednesday(selectedDate);

        // 1. שליפת שיוכי מפתחות לשבוע הספציפי (לפי יום רביעי)
        const { data: keyAssignmentsData, error: keyAssignmentsError } = await supabase
          .from("key_assignments")
          .select(`key_id, request:keys_request!inner(requestee)`)
          .eq("assigned_at", relevantWed);

        if (keyAssignmentsError) throw keyAssignmentsError;

        const keyToBattalion = {};
        (keyAssignmentsData || []).forEach(ka => {
          if (ka.key_id && ka.request?.requestee) {
            keyToBattalion[ka.key_id] = ka.request.requestee;
          }
        });

        // 2. שליפת מפתחות
        const { data: keysData, error: keysError } = await supabase
          .from("keysmanager_keys")
          .select(`id, room_number, room_type_id, has_computers, building_id, room_type(name), building:building_id(name)`)
          .eq("status", "available");

        if (keysError) throw keysError;

        // סינון מפתחות: אם המשתמש הוא קה"ד גדודי, הוא יראה רק את המפתחות ששויכו לגדוד שלו באותו שבוע
        let filteredKeys = keysData;
        const isOnlyKahadGdudi = user?.roles?.includes("קה״ד גדודי בהתנסות") && !user?.roles?.includes("מנהל");

        if (isOnlyKahadGdudi && userGdudId) {
          filteredKeys = keysData.filter(k => keyToBattalion[k.id] === userGdudId);
        }

        const formattedKeys = filteredKeys.map((key) => ({
          id: key.id,
          room_number: key.room_number,
          room_type: key.room_type?.name || "unknown",
          has_computers: key.has_computers,
          building_id: key.building_id,
          building_name: key.building?.name || "unknown",
        }));
        setAllKeys(formattedKeys);

        // 3. שליפת שיעורים
        const { data: lessonsData, error: lessonsError } = await supabase
          .from("schedule_lessons")
          .select(`
            id, start_time, end_time, status, date, room_number, need_computer, needed_room_type_id,
            group_node(id, name, parent_id, group_type_id), 
            room_type:needed_room_type_id(name)
          `)
          .eq("date", selectedDate);

        if (lessonsError) throw lessonsError;

        let filteredLessonsData = lessonsData || [];
        if (userGdudId) {
          filteredLessonsData = [];
          for (const lesson of lessonsData || []) {
            if (lesson.group_node?.group_type_id && lesson.group_node.group_type_id > 2) {
              const isInGdud = await isLessonInUserGdud(lesson.group_node?.id);
              if (isInGdud) filteredLessonsData.push(lesson);
            }
          }
        }

        const formattedLessons = filteredLessonsData.map((l) => {
          const isPlatoon = l.group_node?.group_type_id === 3;
          return {
            id: l.id,
            team_id: l.group_node?.id,
            effective_platoon_id: isPlatoon ? l.group_node?.id : l.group_node?.parent_id,
            team_name: l.group_node?.name || "Unknown",
            start_time: l.start_time,
            end_time: l.end_time,
            room_type_name: l.room_type?.name || "Unknown",
            needs_computers: l.need_computer,
            status: l.status,
            assigned_key: l.room_number,
            date: l.date,
          };
        });
        setLessons(formattedLessons);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedDate, refreshTrigger, userGdudId]);

  // שאר הפונקציות (toggleKeySelection, allocateKeys וכו') נשארות ללא שינוי...

  const toggleKeySelection = (keyId) => {
    setSelectedKeys((prev) => prev.includes(keyId) ? prev.filter((id) => id !== keyId) : [...prev, keyId]);
  };

  const toggleSelectAll = () => {
    setSelectedKeys(selectedKeys.length === allKeys.length ? [] : allKeys.map((k) => k.id));
  };

  const toggleLessonSelection = (lessonId) => {
    setSelectedLessons((prev) => prev.includes(lessonId) ? prev.filter((id) => id !== lessonId) : [...prev, lessonId]);
  };

  const toggleSelectAllLessons = () => {
    const allIds = allItemsToDisplay.map((l) => l.id);
    setSelectedLessons(selectedLessons.length === allIds.length ? [] : allIds);
  };

  const timesOverlap = (start1, end1, start2, end2) => start1 < end2 && start2 < end1;

  const allocateKeys = async () => {
    setIsAllocating(true);
    const lessonsToAllocate = selectedLessons.length > 0
      ? lessons.filter((l) => selectedLessons.includes(l.id))
      : lessons.filter((l) => l.status === 1);

    let availableKeys = allKeys.filter((k) => selectedKeys.includes(k.id));

    if (lessonsToAllocate.length === 0 || availableKeys.length === 0) {
      setIsAllocating(false);
      alert("אין נתונים לשיבוץ");
      return;
    }

    const previousDate = new Date(selectedDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const { data: previousDayLessons } = await supabase
      .from("schedule_lessons")
      .select(`group_node(id, group_type_id, parent_id), room_number`)
      .eq("date", previousDate.toISOString().split("T")[0])
      .eq("status", 2);

    const previousKeyMap = {};
    if (previousDayLessons) {
      for (const lesson of previousDayLessons) {
        if (!lesson.room_number || !lesson.group_node) continue;
        const isPlatoon = lesson.group_node.group_type_id === 3;
        const groupId = isPlatoon ? lesson.group_node.id : lesson.group_node.parent_id;
        previousKeyMap[isPlatoon ? `platoon_${groupId}` : `team_${groupId}`] = lesson.room_number;
      }
    }

    const sortedLessons = [...lessonsToAllocate].sort((a, b) => {
      if (a.room_type_name !== b.room_type_name) return a.room_type_name === "פלוגתי" ? -1 : 1;
      if (a.needs_computers !== b.needs_computers) return a.needs_computers ? -1 : 1;
      return a.start_time.localeCompare(b.start_time);
    });

    const finalUpdates = [];
    const sessionAllocations = [];

    for (const lesson of sortedLessons) {
      let bestKey = null;
      let maxScore = -Infinity;

      for (const key of availableKeys) {
        const hasOverlap = lessons.some((l) => {
          if (l.id === lesson.id || !l.assigned_key) return false;
          return l.assigned_key === key.room_number && timesOverlap(lesson.start_time, lesson.end_time, l.start_time, l.end_time);
        });
        const sessionOverlap = sessionAllocations.some((alloc) => alloc.room_number === key.room_number && timesOverlap(lesson.start_time, lesson.end_time, alloc.start_time, alloc.end_time));

        if (hasOverlap || sessionOverlap) continue;

        let score = 0;
        if (key.room_type === lesson.room_type_name) score += 1000;
        else if (lesson.room_type_name === "צוותי" && key.room_type === "פלוגתי") score += 400;
        else score -= 10000;

        if (previousKeyMap[`team_${lesson.team_id}`] === key.room_number) score += 5000;
        if (previousKeyMap[`platoon_${lesson.effective_platoon_id}`] === key.room_number) score += 4500;

        const teamMatch = lessons.find((l) => l.team_id === lesson.team_id && l.assigned_key === key.room_number);
        if (teamMatch) score += 3000;

        if (score > maxScore) {
          maxScore = score;
          bestKey = key;
        }
      }

      if (bestKey && maxScore > 0) {
        finalUpdates.push({ id: lesson.id, room_number: bestKey.room_number });
        sessionAllocations.push({ room_number: bestKey.room_number, start_time: lesson.start_time, end_time: lesson.end_time });
      }
    }

    for (const up of finalUpdates) {
      await supabase.from("schedule_lessons").update({ room_number: up.room_number, status: 2 }).eq("id", up.id);
    }

    alert(`הוקצו בהצלחה ${finalUpdates.length} שיעורים`);
    setIsAllocating(false);
    setSelectedLessons([]);
    setSelectedKeys([]);
    setRefreshTrigger((prev) => prev + 1);
  };

  const resetAllocations = async () => {
    if (window.confirm("האם למחוק את כל ההקצאות?")) {
      await supabase.from("schedule_lessons").update({ room_number: null, status: 1 }).eq("date", selectedDate).neq("status", 1);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm("האם למחוק את כל השיעורים?")) {
      await supabase.from("schedule_lessons").delete().eq("date", selectedDate);
      setLessons([]);
      setSelectedLessons([]);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleDelete = async (lessonId) => {
    if (window.confirm("האם למחוק שיעור זה?")) {
      await supabase.from("schedule_lessons").delete().eq("id", lessonId);
      setLessons(prev => prev.filter(l => l.id !== lessonId));
    }
  };

  const handleManualAssign = async (lessonId, roomNumber) => {
    const updateValue = roomNumber === "unassign" ? null : roomNumber;
    await supabase.from("schedule_lessons").update({ room_number: updateValue, status: roomNumber === "unassign" ? 1 : 2 }).eq("id", lessonId);
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, assigned_key: updateValue, status: roomNumber === "unassign" ? 1 : 2 } : l));
  };

  const allItemsToDisplay = [...lessons].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const pendingCount = lessons.filter((l) => l.status === 1).length;
  const assignedCount = lessons.filter((l) => l.status === 2).length;

  if (!user) return <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Box>;

  // if (!isAdmin) {
  //   return (
  //     // <Container maxWidth="sm" sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
  //     //   <Card sx={{ p: 4, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '24px' }}>
  //     //     <Shield size={64} color="#f87171" style={{ marginBottom: 16 }} />
  //     //     <Typography variant="h5" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>אין הרשאת גישה</Typography>
  //     //   </Card>
  //     // </Container>
  //   );
  // }
  // בדיקת הרשאות בטעינה ראשונית
  useEffect(() => {
    if (!user) return;
    if (!isAdmin) {
      navigate('/home');
      return;
    }
  }, [user, isAdmin, navigate]);

  const cellStyle = {
    color: isDark ? 'rgba(255,255,255,0.8)' : '#334155',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
  };

  // הרינדור (JSX) נשאר זהה בדיוק
  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b' }}>
              הקצאת מפתחות
            </Typography>
            <Wand2 size={32} color="#10b981" />
          </Box>
          <Typography sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b' }}>
            שיבוץ אוטומטי וידני של מפתחות לשיעורים
          </Typography>
        </Box>
      </motion.div>

      {/* Toolbar */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, justifyContent: "space-between", gap: 2, mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white', p: 1, borderRadius: '16px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0' }}>
          <TextField
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            variant="standard"
            InputProps={{ disableUnderline: true, style: { color: isDark ? 'white' : 'inherit', fontWeight: 500 } }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            onClick={allocateKeys}
            disabled={selectedKeys.length === 0 || pendingCount === 0 || isAllocating}
            sx={{
              bgcolor: "#10b981",
              borderRadius: '12px',
              fontWeight: 600,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': { bgcolor: "#059669" },
              '&:disabled': { bgcolor: '#d1fae5', color: '#065f46' }
            }}
          >
            {isAllocating ? <CircularProgress size={16} color="inherit" /> : <Wand2 size={18} />}
            <span>{selectedLessons.length > 0 ? `שבץ ${selectedLessons.length} נבחרים` : "שבץ אוטומטית"}</span>
          </Button>

          <Button
            variant="outlined"
            onClick={resetAllocations}
            disabled={assignedCount === 0}
            sx={{
              borderRadius: '12px',
              color: 'black',
              borderColor: 'black',
              fontWeight: 600,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': {
                bgcolor: 'rgba(6, 6, 6, 0.1)',
                borderColor: 'black'
              }
            }}
          >
            <RefreshCw size={18} />
            <span>אפס הקצאות</span>
          </Button>
          <Button
            variant="outlined"
            onClick={handleDeleteAll}
            disabled={lessons.length === 0}
            sx={{
              color: "#ef4444",
              borderColor: "#ef4444",
              borderRadius: '12px',
              fontWeight: 600,
              px: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': {
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                borderColor: '#ef4444'
              }
            }}
          >
            <Trash2 size={18} />
            <span>מחק הכל</span>
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }} >
        {[
          { label: 'שובצו', value: `${assignedCount}/${lessons.length}`, color: '#10b981', bg: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5' },
          { label: 'מפתחות זמינים', value: allKeys.length, color: '#3b82f6', bg: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff' },
          { label: 'שיעורים נבחרים', value: selectedLessons.length, color: '#8b5cf6', bg: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff' },
        ].map((stat, i) => (
          <Grid item xs={12} sm={4} key={i}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card sx={{ p: 3, borderRadius: '20px', bgcolor: stat.bg, border: `1px solid ${stat.color}30`, boxShadow: 'none' }}>
                <Typography variant="caption" sx={{ color: stat.color, fontWeight: 700 }}>{stat.label}</Typography>
                <Typography variant="h4" sx={{ color: isDark ? 'white' : '#1e293b', fontWeight: 700 }}>{stat.value}</Typography>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4, alignItems: 'stretch' }}>
        {/* Available Keys Column */}
        <Grid item xs={12} lg={4}>
          <Card sx={{
            p: 0,
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
            borderRadius: '24px',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
            overflow: 'hidden',
            direction: 'rtl'
          }}>
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: isDark ? 'white' : '#1e293b', fontWeight: 600 }}>
                  מפתחות זמינים
                </Typography>
                <Key size={20} color="#3b82f6" />
              </Box>
              <Button
                size="small"
                onClick={toggleSelectAll}
                sx={{
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  color: isDark ? 'white' : '#374151',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                }}
              >
                {selectedKeys.length === allKeys.length ? "בטל הכל" : "בחר הכל"}
              </Button>
            </Box>
            <Box sx={{ maxHeight: '600px', overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {allKeys.map(key => (
                <Paper
                  key={key.id}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                    border: selectedKeys.includes(key.id)
                      ? '2px solid #10b981'
                      : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }
                  }}
                  onClick={() => toggleKeySelection(key.id)}
                >
                  <Checkbox
                    checked={selectedKeys.includes(key.id)}
                    sx={{
                      color: '#d1d5db',
                      marginLeft: 'auto',
                      '&.Mui-checked': { color: '#10b981' },
                      '& .MuiSvgIcon-root': { fontSize: 28 }
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b', mb: 1 }}>
                      חדר {key.room_number}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Box sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: '#d1fae5',
                        color: '#065f46',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}>
                        {key.room_type === "פלוגתי" ? "🏢" : "🏠"} {key.room_type}
                      </Box>
                      <Box sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: '#f3f4f6',
                        color: '#374151',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}>
                        <Building size={14} />
                        {key.building_name}
                      </Box>
                      {key.has_computers && (
                        <Box sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          bgcolor: '#e0e7ff',
                          color: '#3730a3',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 2,
                          fontSize: '0.85rem',
                          fontWeight: 500,
                        }}>
                          💻 מחשב
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Card>
        </Grid>

        {/* Lessons Column */}
        <Grid item xs={12} lg={8} sx={{ display: "flex" }}>
          <Card sx={{
            width: '100%',
            flex: 1,
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
            borderRadius: '24px',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f1f5f9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Calendar size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                <Typography variant="h6" sx={{ color: isDark ? 'white' : '#1e293b', fontWeight: 600 }}>לוח זמנים שיעורים</Typography>
              </Box>
              <Button size="small" onClick={toggleSelectAllLessons} sx={{ borderRadius: '8px' }}>
                {selectedLessons.length === allItemsToDisplay.length ? "בטל הכל" : "בחר הכל"}
              </Button>
            </Box>
            <TableContainer sx={{ maxHeight: '600px' }}>
              <Table stickyHeader size="small" sx={{ minWidth: 750 }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>✓</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>שעה</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>קבוצה</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>סוג</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>💻</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>סטטוס</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>חדר</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>הקצאה</TableCell>
                    <TableCell align="center" sx={{ bgcolor: isDark ? '#1e293b' : '#f8fafc', ...cellStyle }}>מחק</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                  ) : allItemsToDisplay.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>אין שיעורים לתאריך זה</TableCell></TableRow>
                  ) : (
                    allItemsToDisplay.map(lesson => (
                      <TableRow key={lesson.id} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' } }}>
                        <TableCell align="center" sx={cellStyle}>
                          <Checkbox
                            checked={selectedLessons.includes(lesson.id)}
                            onChange={() => toggleLessonSelection(lesson.id)}
                            size="small"
                            sx={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', '&.Mui-checked': { color: '#3b82f6' } }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ ...cellStyle, fontFamily: 'monospace' }}>
                          {lesson.start_time?.slice(0, 5)} - {lesson.end_time?.slice(0, 5)}
                        </TableCell>
                        <TableCell align="center" sx={{ ...cellStyle, fontWeight: 500 }}>{lesson.team_name}</TableCell>
                        <TableCell align="center" sx={cellStyle}>
                          <Chip
                            label={lesson.room_type_name === "פלוגתי" ? "🏢 פלוגתי" : lesson.room_type_name === "דו״צ" ? "👥 דו״צ" : "🏠 צוותי"}
                            size="small"
                            sx={{
                              bgcolor:
                                lesson.room_type_name === "פלוגתי"
                                  ? (isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff')
                                  : lesson.room_type_name === "דו״צ"
                                    ? (isDark ? 'rgba(234, 88, 12, 0.15)' : '#fff7ed')
                                    : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe'),
                              color:
                                lesson.room_type_name === "פלוגתי"
                                  ? '#a855f7'
                                  : lesson.room_type_name === "דו״צ"
                                    ? '#ea580c'
                                    : '#2563eb',
                              fontSize: '0.75rem', fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={cellStyle}>
                          {lesson.needs_computers ? '💻' : <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1' }}>-</Typography>}
                        </TableCell>
                        <TableCell align="center" sx={cellStyle}>
                          {lesson.status === 2
                            ? <CheckCircle size={18} color="#10b981" />
                            : <AlertTriangle size={18} color="#eab308" />
                          }
                        </TableCell>
                        <TableCell align="center" sx={cellStyle}>
                          {lesson.assigned_key ? (
                            <Chip label={lesson.assigned_key} size="small" sx={{ bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5', color: '#059669', fontWeight: 700 }} />
                          ) : <Typography sx={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1' }}>-</Typography>}
                        </TableCell>
                        <TableCell align="center" sx={cellStyle}>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={lesson.assigned_key || ""}
                              onChange={(e) => handleManualAssign(lesson.id, e.target.value)}
                              displayEmpty
                              variant="standard"
                              disableUnderline
                              sx={{
                                fontSize: '0.875rem',
                                color: isDark ? 'white' : 'inherit',
                                '& .MuiSelect-select': { py: 0.5 }
                              }}
                            >
                              <MenuItem value="" disabled sx={{ fontSize: '0.875rem' }}>בחר</MenuItem>
                              {lesson.assigned_key && <MenuItem value="unassign" sx={{ color: "#ef4444", fontSize: '0.875rem' }}>❌ בטל</MenuItem>}
                              {allKeys.map((key) => (
                                <MenuItem key={key.id} value={key.room_number} sx={{ fontSize: '0.875rem' }}>
                                  {key.room_type === "פלוגתי" ? "🏢" : "🏠"} {key.room_number}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="center" sx={cellStyle}>
                          <IconButton size="small" onClick={() => handleDelete(lesson.id)} sx={{ color: '#ef4444', opacity: 0.7, '&:hover': { opacity: 1, bgcolor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2' } }}>
                            <Trash2 size={16} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default KeysAllocator;