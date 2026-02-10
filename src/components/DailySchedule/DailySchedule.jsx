import React from "react";
import {
    Box,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    Paper,
    Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

/**
 * Pill Component - תג מעוצב לשימוש בתוך הטבלה
 */
const Pill = ({ icon, text, bg, color }) => (
    <Box
        sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.8,
            px: 1.5,
            py: 0.5,
            borderRadius: '999px',
            fontWeight: 700,
            fontSize: '0.85rem',
            bgcolor: bg,
            color,
            whiteSpace: 'nowrap',
        }}
    >
        {icon}
        <Box component="span" sx={{ mt: 0.2 }}>{text}</Box>
    </Box>
);

/**
 * סטטוסים - מוגדרים לפי ההיגיון של המערכת
 */
const StatusBadge = ({ lesson }) => {
    const statusId = Number(lesson?.status) || 1;
    const effective = lesson?.room_number ? 2 : statusId;

    if (effective === 2) {
        return (
            <Pill
                icon={<CheckCircleIcon sx={{ fontSize: '1.1rem' }} />}
                text="שובץ"
                bg="#DCFCE7"
                color="#065F46"
            />
        );
    }

    return (
        <Pill
            icon={<AccessTimeIcon sx={{ fontSize: '1.1rem' }} />}
            text="ממתין"
            bg="#FEF3C7"
            color="#92400E"
        />
    );
};

const RoomBadge = ({ room }) => {
    if (!room) return <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>טרם נקבע</Typography>;
    return (
        <Pill
            icon={<span style={{ fontSize: 16 }}>🔑</span>}
            text={`חדר ${room}`}
            bg="#E0E7FF"
            color="#3730A3"
        />
    );
};

const RoomTypeBadge = ({ roomType }) => {
    if (!roomType || roomType === '-') return <Typography sx={{ color: '#94a3b8' }}>-</Typography>;
    const isTeamRoom = roomType.includes('צוות');

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <span style={{ fontSize: 16 }}>{isTeamRoom ? '🏠' : '🏢'}</span>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{roomType}</Typography>
        </Box>
    );
};

const ComputerBadge = ({ needComputer }) => {
    return needComputer ? (
        <Box title="דרוש מחשב">
            <Typography sx={{ fontSize: '1.2rem' }}>💻</Typography>
        </Box>
    ) : (
        <Typography sx={{ color: '#94a3b8' }}>-</Typography>
    );
};

export default function DailySchedule({ classes, teamNameById }) {
    if (!classes || classes.length === 0) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary" variant="h6" sx={{ direction: 'rtl' }}>
                    אין שיעורים מתוכננים להיום 🎉
                </Typography>
            </Box>
        );
    }

    return (
        <TableContainer
            component={Paper}
            dir="rtl"
            sx={{
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'transparent'
            }}
        >
            <Table sx={{ width: '100%' }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: "rgba(0, 0, 0, 0.02)" }}>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>עבור</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>שעה</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>סוג חדר</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>מחשבים</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>סטטוס</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>מיקום</TableCell>
                        <TableCell align="left" sx={{ fontWeight: 700, color: '#475569' }}>הערות</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {classes.map((lesson) => (
                        <TableRow 
                            key={lesson.id} 
                            hover 
                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                            {/* עמודה ימנית - שם הצוות */}
                            <TableCell align="right">
                                <Typography sx={{ fontWeight: 600, color: '#1e293b' }}>
                                    {teamNameById?.[String(lesson.team_id)] || '-'}
                                </Typography>
                            </TableCell>

                            {/* שעות - מוגדר כ-LTR כדי שהסימנים לא יתהפכו */}
                            <TableCell align="center">
                                <Box sx={{ 
                                    direction: 'ltr', 
                                    display: 'inline-flex', 
                                    fontWeight: 500,
                                    color: '#334155',
                                    bgcolor: 'rgba(0,0,0,0.03)',
                                    px: 1, borderRadius: '6px'
                                }}>
                                    {lesson.start_time?.slice(0, 5)} - {lesson.end_time?.slice(0, 5)}
                                </Box>
                            </TableCell>

                            <TableCell align="center">
                                <RoomTypeBadge roomType={lesson.room_type?.name || '-'} />
                            </TableCell>

                            <TableCell align="center">
                                <ComputerBadge needComputer={lesson.need_computer} />
                            </TableCell>

                            <TableCell align="center">
                                <StatusBadge lesson={lesson} />
                            </TableCell>

                            <TableCell align="center">
                                <RoomBadge room={lesson.room_number} />
                            </TableCell>

                            {/* עמודה שמאלית - הערות */}
                            <TableCell align="left">
                                <Typography
                                    sx={{
                                        maxWidth: 200,
                                        fontSize: '0.85rem',
                                        color: '#64748b',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        cursor: 'help'
                                    }}
                                    title={lesson.notes || ''}
                                >
                                    {lesson.notes || '-'}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}