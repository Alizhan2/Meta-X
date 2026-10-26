import {createHash} from 'node:crypto';

export const stopPolicy=Object.freeze({version:2,unchangedActions:3,tabCycleMinimum:2,repeatedNavigationActions:4});

export function observationKey(observation){
  // Ignore pixels (caret/animation noise); include observable selection and scroll.
  return createHash('sha256').update(JSON.stringify({url:observation.url??null,semantics:observation.semantics,focus:observation.focus,viewport:observation.viewport??null})).digest('hex');
}

export function createProgressMonitor(initial){
  const navigationKey=observation=>observationKey({...observation,viewport:null});
  let current=observationKey(initial),navigationCurrent=navigationKey(initial),unchanged=0,direction=null,path=[];
  let known=new Set([navigationCurrent]),revisits=0;
  let terminal=null;
  return Object.freeze({
    beforeAction(observation){
      const observed=observationKey(observation);
      if(observed!==current){current=observed;navigationCurrent=navigationKey(observation);unchanged=0;direction=null;path=[];known=new Set([navigationCurrent]);revisits=0;}
    },
    afterAction(action,observation,index){
      if(terminal)return {stop:terminal};
      const next=observationKey(observation);
      const navigationNext=navigationKey(observation);
      unchanged=next===current?unchanged+1:0;
      const key=action.name==='press_key'?action.arguments.key:null;
      if(key==='Tab'||key==='Shift+Tab'){
        if(known.has(navigationNext))revisits++;else {known.add(navigationNext);revisits=0;}
        if(direction!==key){direction=key;path=[{state:navigationCurrent,index:index-1}];}
        const previous=path.find(item=>item.state===navigationNext);
        if(previous&&navigationNext!==navigationCurrent&&index-previous.index>=stopPolicy.tabCycleMinimum){
          terminal={source:'runner',reason:'focus_navigation_cycle',atStep:index,cycleStart:previous.index,cycleLength:index-previous.index,state:navigationNext};
        }
        path.push({state:navigationNext,index});
        if(revisits>=stopPolicy.repeatedNavigationActions)terminal={source:'runner',reason:'repeated_navigation_states',atStep:index,repeatedActions:revisits,state:navigationNext};
      }else{direction=null;path=[];revisits=0;known=new Set([navigationNext]);}
      if(unchanged>=stopPolicy.unchangedActions){
        terminal={source:'runner',reason:'unchanged_observation',atStep:index,unchangedActions:unchanged,state:next};
      }
      const checkpoint={before:current,after:next,unchangedActions:unchanged};
      current=next;navigationCurrent=navigationNext;
      return {checkpoint,stop:terminal};
    }
  });
}
