(() => {
  const picker=document.getElementById('scheduleWeekPicker');
  const history=[...document.querySelectorAll('.calendar-history-card-v59660')];
  return {
    build: window.__tuinbooksCalendarHistoryBuild || null,
    selectedWeek: picker?.value || null,
    minWeek: picker?.min || null,
    maxWeek: picker?.max || null,
    historicalWeekCards: history.length,
    previousButton: !!document.querySelector('[onclick="shiftScheduleWeekV59660(-1)"]'),
    todayButton: !!document.querySelector('[onclick="goToCurrentScheduleWeekV59660()"]'),
    nextButton: !!document.querySelector('[onclick="shiftScheduleWeekV59660(1)"]'),
    missedHistoryCards: history.filter(card=>card.classList.contains('attention')).length
  };
})()
