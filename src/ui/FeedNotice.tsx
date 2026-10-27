import { useStore } from '../store.ts';
import { NOT_A_FEED, PRESETS, ROUTES } from '../data/science.ts';

/** Shown when the current composition isn't something this route would bioleach (a battery, a cable…). */
export function FeedNotice({ where }: { where: 'metals' | 'leach' }) {
  const presetId = useStore((s) => s.presetId);
  const set = useStore((s) => s.set);
  const stream = NOT_A_FEED[presetId];
  if (!stream) return null;
  const route = ROUTES[stream];
  const toBoard = () => set({ presetId: 'pc_board', simple: { ...useStore.getState().simple, cu: PRESETS.pc_board.comp.Cu! } });
  return (
    <div className={`feed-notice is-${route.verdict}`} role="note">
      <p>
        <b>{route.headline}.</b>{' '}
        {where === 'metals'
          ? 'The 3D board shows where metals sit in a circuit board, for comparison.'
          : `Bioleaching isn’t the route for a ${PRESETS[presetId].name.toLowerCase()}, so treat these numbers as a what-if.`}
      </p>
      <button type="button" className="link" onClick={toBoard}>Simulate a PC board instead</button>
    </div>
  );
}
