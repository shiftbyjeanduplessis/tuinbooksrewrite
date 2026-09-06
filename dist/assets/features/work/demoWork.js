import { demoWeek } from '../schedule/demoData.js';
import { startOfWeek } from '../../domain/dates.js';
export function demoWorkDay(date) {
    const week = demoWeek(startOfWeek(date));
    const visits = week.visits.filter(v => v.date === date);
    if (visits[0])
        visits[0] = { ...visits[0], status: 'completed' };
    const workRecords = visits[0] ? [{ id: 'demo-work-1', businessId: 'demo', scheduleJobId: visits[0].id, accountId: visits[0].accountId, serviceLocationId: visits[0].serviceLocationId, teamId: visits[0].teamId, date, tasks: [{ task: 'Garden service', outcome: 'Done', note: '' }], extraDescription: 'Completed normally.', photoPaths: [], outcome: 'Completed', createdAt: new Date().toISOString(), payload: {} }] : [];
    const opportunities = visits[1] ? [{ id: 'demo-opp-1', businessId: 'demo', accountId: visits[1].accountId, scheduleJobId: visits[1].id, workRecordId: null, teamId: visits[1].teamId, category: 'Irrigation', note: 'Possible leak near back lawn.', photoPaths: [], status: 'new', reviewDecision: 'new', createdAt: new Date().toISOString(), payload: {} }] : [];
    return { date, teams: week.teams, accounts: week.accounts, locations: week.locations, visits, workRecords, opportunities, clientHolds: week.clientHolds, dayActions: week.dayActions.filter(a => a.date === date) };
}
//# sourceMappingURL=demoWork.js.map