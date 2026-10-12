'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableHeader({ id, skill_name, onSettingsClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border-b border-slate-200 border-r w-24 min-w-[96px] text-center font-bold text-slate-700 bg-slate-50 leading-tight cursor-grab active:cursor-grabbing hover:bg-slate-100 relative z-20 align-bottom group"
    >
      <div className="flex flex-col items-center justify-end gap-1.5 h-full min-h-[60px] relative w-full">
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={(e) => { e.stopPropagation(); onSettingsClick(id); }}
          className="absolute top-0 right-0 p-1 text-slate-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Column Settings"
        >
          ⚙️
        </button>
        <span className="text-slate-400 text-sm leading-none select-none">⋮⋮</span>
        <span className="whitespace-normal break-words text-[11px] leading-tight px-1 pb-1">
          {skill_name}
        </span>
      </div>
    </th>
  );
}

export default function SubjectMatrix({
  activeTab, handleAddSkill, newSkillName, setNewSkillName, isAddingSkill, activeFilter,
  columnError, sortedPupils, activeSkills, handleDragEnd, openSkillSettings,
  openPupilDrawer, renderPupilName, progress, handleCellCycle, handleRightClick, sensors,
  selectedForSweep, toggleSelectPupil, toggleSelectAll
}) {
  
  const filteredPupils = sortedPupils.filter(pupil => {
    if (activeFilter === 'all') return true;
    const hasMatch = activeSkills.some(skill => {
      const cell = progress.find(p => p.pupil_id === pupil.id && p.skill_id === skill.id);
      if (!cell) return false;
      if (activeFilter === 'blue') return cell.status === 'green' && cell.next_review_date && new Date() >= new Date(cell.next_review_date);
      return cell.status === activeFilter;
    });
    return hasMatch;
  });

  return (
    <div className="h-full flex flex-col flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4 shrink-0">
        <h2 className="text-lg font-bold text-slate-800 capitalize mt-2">{activeTab.replace('-', ' ')}</h2>
        <div className="flex flex-col items-end w-full sm:w-auto">
          <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input type="text" required value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="New Column (e.g. Fractions)" className="border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-64" />
            <button type="submit" disabled={isAddingSkill} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:bg-indigo-400 w-full sm:w-auto whitespace-nowrap">
              {isAddingSkill ? '...' : '+ Add Column'}
            </button>
          </form>
          {columnError && (
            <div className="text-red-600 text-xs font-bold mt-2 bg-red-50 px-3 py-1.5 rounded border border-red-100 w-full text-center sm:text-right">
              🚨 {columnError}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm relative min-h-0">
        {filteredPupils.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No pupils match the current filter.</div>
        ) : activeSkills.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">Use the "+ Add Column" button above to build your {activeTab} curriculum.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="p-3 border-b border-slate-200 border-r w-auto whitespace-nowrap pr-6 font-extrabold text-slate-700 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] sticky left-0 z-40 align-bottom pb-2">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={filteredPupils.length > 0 && filteredPupils.every(p => selectedForSweep.has(p.id))} 
                        onChange={() => toggleSelectAll(filteredPupils)} 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                      />
                      <span>Class Roster</span>
                    </div>
                  </th>
                  <SortableContext items={activeSkills.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                    {activeSkills.map(skill => (
                      <SortableHeader key={skill.id} id={skill.id} skill_name={skill.skill_name} onSettingsClick={openSkillSettings} />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {filteredPupils.map(pupil => (
                  <tr key={pupil.id} className="hover:bg-slate-50 transition-colors group/row">
                    <td className="p-3 border-b border-slate-200 border-r bg-white group-hover/row:bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-auto whitespace-nowrap pr-6">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={selectedForSweep.has(pupil.id)} 
                          onChange={() => toggleSelectPupil(pupil.id)} 
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                        />
                        <button onClick={() => openPupilDrawer(pupil)} className="font-semibold text-slate-700 hover:text-indigo-600 transition-colors text-left w-full">
                          {renderPupilName(pupil)}
                        </button>
                      </div>
                    </td>
                    {activeSkills.map(skill => {
                      const cellData = progress.find(p => p.pupil_id === pupil.id && p.skill_id === skill.id);
                      const baseStatus = cellData ? cellData.status : 'blank';
                      
                      let visualStatus = baseStatus;
                      let fillPercentage = 100;

                      if (baseStatus === 'green' && cellData?.last_assessed_at && cellData?.next_review_date) {
                        const start = new Date(cellData.last_assessed_at).getTime();
                        const end = new Date(cellData.next_review_date).getTime();
                        const now = new Date().getTime();

                        if (now >= end) {
                          visualStatus = 'blue';
                          fillPercentage = 0;
                        } else {
                          const totalDuration = end - start;
                          const elapsed = now - start;
                          const drainPct = (elapsed / totalDuration) * 100;
                          fillPercentage = Math.max(0, 100 - drainPct);
                        }
                      }

                      let bgClass = 'bg-slate-50 hover:bg-slate-100 border-slate-200 group-hover/row:border-slate-300';
                      let innerFill = null;

                      if (visualStatus === 'red') bgClass = 'bg-red-500 hover:bg-red-600 border-red-600 shadow-inner';
                      if (visualStatus === 'orange') bgClass = 'bg-amber-400 hover:bg-amber-500 border-amber-500 shadow-inner';
                      if (visualStatus === 'blue') bgClass = 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-inner';
                      
                      if (visualStatus === 'green') {
                        if (fillPercentage >= 80) {
                          bgClass = 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 shadow-inner';
                        } else {
                          bgClass = 'bg-slate-50 border-emerald-600 shadow-inner relative overflow-hidden group/cell';
                          innerFill = <div className="absolute bottom-0 left-0 w-full bg-emerald-400 group-hover/cell:bg-emerald-500 transition-colors" style={{ height: `${fillPercentage}%` }}></div>;
                        }
                      }

                      return (
                        <td key={`${pupil.id}-${skill.id}`} className="p-1 border-b border-slate-200 border-r text-center align-middle">
                          <div className="flex items-center justify-center relative">
                            <button 
                              onClick={(e) => handleCellCycle(pupil.id, skill.id, e)} 
                              onContextMenu={(e) => handleRightClick(e, pupil.id, skill.id)}
                              className={`w-8 h-8 rounded-sm transition-all border shadow-sm relative block ${bgClass}`}
                            >
                              {innerFill}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </DndContext>
        )}
      </div>
    </div>
  );
}
