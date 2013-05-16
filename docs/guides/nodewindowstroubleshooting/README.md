# Troubleshooting

If you are encountering the _invalidinstallation_ event, take a look at the `daemon`
directory that is created during the installation to make sure the `.exe` and `.xml`
files are there. In some circumstances, primarily during _un_installation, it is
possbile for the process to temporarily lock a log file, which prevents Windows
from removing it. In this scenario, simply run the uninstall again. In most cases this
will fix the issue. If not, manually remove the `daemon` directory before running the
installation again.

## Node-Windows Tests

node-windows uses several command line scripts to execute processes and bypass the need
for native modules. Additionally, node-windows attempts to handle account permissions, but
tests will still fail if they are not run with the appropriate account credentials. Therefore,
it is hard to decipher whether an issue stems from a user account, credentials, elevated permmissions,
or the code itself.

In a _best effort_ fashion, the examples are rudimentary. They have been tested and are known
to work. If you experience problems with the module, it is best to try running the examples first to
verify basic functionality.

## Testing Services

node-windows ships with a service/daemon management tool. It is important to note that installing
and uninstalling processes, which use `winsw.exe`, can take some time to complete. In particular,
there is a problem if you attempt to uninstall a process before it has completed installation.
Windows locks a log file while installing the process, which cannot be removed until the installation
is complete.

## Other Issue?

If you are having other issues, please post them in the [bug tracker](https://github.com/coreybutler/node-windows/issues).
