import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import { Cube } from 'react-cube-svg';
import calcStats from '../../lib/stats';
import {
  submitResult,
  sendStatus,
} from '../../store/room/actions';
import { StatsDialogProvider } from './StatsDialogProvider';
import TimesTable from './TimesTable';
import Timer from '../Timer/index';
import Scramble from '../Scramble';
import UserStats from './UserStats';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    padding: theme.spacing(0),
    borderRadius: 0,
    height: '100%',
  },
  waitingForBox: {
    padding: '.5em',
  },
}));

function Main({
  dispatch, room, user, timerFocused,
}) {
  const classes = useStyles();

  const onSubmitTime = (event) => {
    if (!room.attempts.length) {
      return;
    }

    // Don't even bother sending the result.
    if (!user.id) {
      return;
    }

    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    dispatch(submitResult({
      id: latestAttempt.id,
      result: {
        time: event.time,
        penalties: event.penalties,
      },
    }));
  };

  const handleStatusChange = (status) => {
    dispatch(sendStatus(status));
  };

  const {
    users, attempts, waitingFor,
  } = room;
  const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
  const timerDisabled = !timerFocused || !room.competing[user.id]
    || room.waitingFor.indexOf(user.id) === -1;
  const hidden = room.competing[user.id] && waitingFor.indexOf(user.id) === -1;

  const stats = calcStats(attempts, users);
  const showScramble = latestAttempt.scrambles && room.event === '333';

  return (
    <Paper className={classes.root} variant="outlined" square>
      <StatsDialogProvider>
        <Scramble
          event={room.event}
          disabled={timerDisabled}
          hidden={hidden}
          scrambles={latestAttempt.scrambles}
        />
        <Divider />
        {room.competing[user.id] && (
          <Timer
            disabled={timerDisabled}
            onSubmitTime={(e) => onSubmitTime(e)}
            onStatusChange={handleStatusChange}
            useInspection={user.useInspection}
            type={user.timerType}
          />
        )}
        <Divider />
        <TimesTable room={room} stats={stats} />
        <Grid container>
          <Grid item xs={showScramble ? 10 : 12} sm={showScramble ? 9 : 12}>
            <UserStats stats={stats[user.id]} />
            <Paper
              className={classes.waitingForBox}
              square
              variant="outlined"
            >
              <Typography variant="body2">
                Waiting For:
                {' '}
                {waitingFor.map((userId) => users.find((u) => u.id === userId)).filter((u) => !!u).map((u) => u.displayName).join(', ')}
              </Typography>
            </Paper>
          </Grid>
          {showScramble && (
            <Grid item xs={2} sm={3}>
              <Paper
                square
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
                variant="outlined"
              >
                <Cube
                  size="120"
                  scramble={latestAttempt.scrambles ? latestAttempt.scrambles[0] : ''}
                />
              </Paper>
            </Grid>
          )}
        </Grid>
      </StatsDialogProvider>
    </Paper>
  );
}

Main.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    event: PropTypes.string,
    users: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    competing: PropTypes.shape(),
    waitingFor: PropTypes.array,
    statuses: PropTypes.shape(),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    useInspection: PropTypes.bool,
    timerType: PropTypes.string,
  }),
  timerFocused: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
};

Main.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    event: '333',
    users: [],
    competing: {},
    waitingFor: [],
    statues: {},
    attempts: [],
    admin: {
      id: undefined,
    },
  },
  user: {
    id: undefined,
    useInspection: false,
    timerType: 'spacebar',
  },
  timerFocused: true,
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(Main);
