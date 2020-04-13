import React from 'react';
import PropTypes from 'prop-types';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import PublicIcon from '@material-ui/icons/Public';
import PrivateIcon from '@material-ui/icons/Lock';
import ListItemLink from './ListItemLink';
import { getNameFromId } from '../lib/wca';

function RoomListItem({ room, disabled }) {
  const userText = room.usersLength === 0 ? ' empty' : ` ${room.usersLength} user${room.usersLength > 1 ? 's' : ''}`;

  return (
    <ListItemLink
      to={`/rooms/${room._id}`}
      disabled={disabled}
    >
      <ListItemIcon>
        { room.private
          ? <PrivateIcon />
          : <PublicIcon />}
      </ListItemIcon>
      <ListItemText
        primary={(
          <Typography variant="h6">
            {room.name}
          </Typography>
      )}
        secondary={(
          <Typography>
            {getNameFromId(room.event)}
            {' '}
|
            {userText}
          </Typography>
      )}
      />
    </ListItemLink>
  );
}

RoomListItem.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    event: PropTypes.string,
    private: PropTypes.bool,
    usersLength: PropTypes.number,
  }),
  disabled: PropTypes.bool,
};

RoomListItem.defaultProps = {
  room: {
    _id: undefined,
    name: undefined,
    event: undefined,
    private: false,
    usersLength: 0,
  },
  disabled: true,
};

export default RoomListItem;
