'use strict';
(function(root){
const DAY=86400000;
function sundays(start,end){if(!Number.isInteger(start)||!Number.isInteger(end)||end<start)return 0;const first=start+(7-new Date(start*DAY).getUTCDay())%7;return first>end?0:Math.floor((end-first)/7)+1;}
function proposal(task,dates,complete=false){const count=dates?sundays(dates.s,dates.f):0,already=task.sundayAdjustment?.appliedDuration===task.dur,reason=task.ms?'Веха':task.stretch?'Срок задаётся связями':complete?'Завершена':!dates?'Нет сроков':already?'Уже учтено':!count?'Нет воскресений':'';return{id:task.id,count,duration:Math.ceil(task.dur||0),proposed:Math.ceil(task.dur||0)+count,eligible:!reason,reason};}
root.GPR_FACADE_OPTIONS={sundays,proposal};if(typeof module!=='undefined')module.exports=root.GPR_FACADE_OPTIONS;
})(typeof window!=='undefined'?window:globalThis);
