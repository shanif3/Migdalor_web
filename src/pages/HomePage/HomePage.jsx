import { Box, Card, Container, Grid, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';
import { supabase } from 'lib/supabaseClient';

// Components
import UnifiedPlanner from 'components/UnifiedPlanner/UnifiedPlanner';
import DailySchedule from 'components/DailySchedule/DailySchedule';

export default function Home() {
    const { user, isDark } = useOutletContext();
    const [dailyClasses, setDailyClasses] = useState([]);
    const [teamNameById, setTeamNameById] = useState({});
    const [companyId, setCompanyId] = useState(null);

    // 1. טעינת מפת שמות הצוותים (נשאר כפי שהיה)
    const fetchTeamsMap = async () => {
        // מביאים גם צוותים (4) וגם פלוגות (למשל 3, או פשוט להוריד את הסינון אם הרשימה קטנה)
        const { data, error } = await supabase
            .from('group_node')
            .select('id, name');

        if (error) {
            console.error('Error fetching teams map:', error);
            return;
        }

        const map = {};
        (data || []).forEach(t => {
            map[String(t.id)] = t.name;
        });
        setTeamNameById(map);
    };

    useEffect(() => {
        fetchTeamsMap();
    }, []);

    // 2. שליפת שיעורים: צוות + פלוגה
    useEffect(() => {
        if (!user?.group_id) return;

        const today = new Date().toLocaleDateString('en-CA');

        const fetchDailyClassesForMyCompany = async () => {
            try {
                // א) מציאת הפלוגה (parent_id) של הצוות שלי
                const { data: myTeam, error: teamErr } = await supabase
                    .from('group_node')
                    .select('id, parent_id')
                    .eq('id', user.group_id)
                    .single();

                if (teamErr) throw teamErr;

                const parentId = myTeam?.parent_id ? String(myTeam.parent_id) : null;
                setCompanyId(parentId);

                // ב) הבאת כל הצוותים ששייכים לאותה פלוגה
                let allRelatedIds = [String(user.group_id)];

                if (parentId) {
                    const { data: companyTeams, error: teamsErr } = await supabase
                        .from('group_node')
                        .select('id')
                        .eq('parent_id', parentId);

                    if (teamsErr) throw teamsErr;

                    // רשימה הכוללת: את הפלוגה עצמה + כל הצוותים שתחתיה
                    allRelatedIds = [
                        parentId,
                        ...(companyTeams || []).map(t => String(t.id))
                    ];
                }

                // ג) שליפת השיעורים לכל ה-IDs הללו יחד
                const { data, error } = await supabase
                    .from('schedule_lessons')
                    .select(`
                        *,
                        room_type:needed_room_type_id ( id, name )
                    `)
                    .eq('date', today)
                    .in('team_id', allRelatedIds)
                    .order('start_time', { ascending: true });

                if (error) throw error;
                setDailyClasses(data || []);

            } catch (e) {
                console.error('Error fetching daily classes:', e);
                setDailyClasses([]);
            }
        };

        fetchDailyClassesForMyCompany();
    }, [user?.group_id]);

    // 3. סינון הלוגיקה לתצוגה
    const filteredDailyClasses = dailyClasses.filter(lesson => {
        const lessonTeamId = String(lesson.team_id);
        const myTeamId = String(user.group_id);
        const myCompanyId = companyId ? String(companyId) : null;

        // מציגים אם זה הצוות שלי OR אם זה משויך ישירות לפלוגה שלי
        return lessonTeamId === myTeamId || lessonTeamId === myCompanyId;
    });

    if (!user) return null;

    return (
        <Container maxWidth={false} sx={{ px: 4, py: 6 }}>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Box
                        component="img"
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                        alt="לוגו"
                        sx={{ width: 96, height: 96, objectFit: 'contain', mx: 'auto', mb: 3 }}
                    />
                    <Typography variant="h3" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b', mb: 1.5, textAlign: 'center', direction: 'rtl' }}>
                        שלום {user.full_name} 👋
                    </Typography>
                    <Typography variant="h6" sx={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#475569', textAlign: 'center', direction: 'rtl' }}>
                        מגדלור, כאן בשבילך 🙂
                    </Typography>
                </Box>
            </motion.div>

            <Box mt={8}>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                            <Card sx={{ p: 3, background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', backdropFilter: 'blur(20px)', borderRadius: '24px', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0', boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)' }} dir="rtl">
                                <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: isDark ? 'white' : '#1e293b', textAlign: 'right' }}>
                                    📋 משימות חודשיות
                                </Typography>
                                <UnifiedPlanner />
                            </Card>
                        </motion.div>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                            <Card sx={{ p: 3, background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white', backdropFilter: 'blur(20px)', borderRadius: '24px', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0', boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)', width: '100%' }}>
                                <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: isDark ? 'white' : '#1e293b', textAlign: 'right', direction: 'rtl' }}>
                                    📅 לו"ז יומי
                                </Typography>
                                <DailySchedule classes={filteredDailyClasses} teamNameById={teamNameById} />
                            </Card>
                        </motion.div>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
}