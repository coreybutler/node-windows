using System;
using System.Diagnostics;
using System.Security;
using System.Text;

namespace eventcreate
{
   public class Program
   {
      static void Main(string[] args)
      {
         bool showUsageOnly = false;
         string logName = string.Empty;
         string source = string.Empty;
         string message = string.Empty;
         string typeString = string.Empty;
         string idString = string.Empty;
         bool descriptionProvided = false;

         if (args.Length == 0)
         {
            showUsageOnly = true;
         }
         else
         {
            for (int i = 0; i < args.Length; i++)
            {
               string key = args[i];
               string value = string.Empty;
               if ((i + 1) < args.Length)
               {
                  value = args[i + 1];
               }

               switch (key.ToLower())
               {
                  case "/l": logName = value; break;
                  case "/t": typeString = value; break;
                  case "/so": source = value; break;
                  case "/id": idString = value; break;
                  case "/d": 
                     message = value;
                     descriptionProvided = true;
                     break;
                  case "/?": showUsageOnly = true; break;
               }
            }

         }

         if (showUsageOnly)
         {
            showUsage();
            return;
         }

         try
         {
            if (!EventLog.SourceExists(source))
            {
               EventLog.CreateEventSource(source, logName);
            }
         }
         catch (SecurityException ex)
         {
            Console.WriteLine(
                "\r\nA security error occurred, try running with elevated " +
                "security permissions (Run as Administrator).\r\n\r\n" +
                ex.Message);
            return;
         }

         EventLogEntryType type = EventLogEntryType.Information;
         switch (typeString.ToLower())
         {
            case "error":
               type = EventLogEntryType.Error; break;

            case "failureaudit":
               type = EventLogEntryType.FailureAudit; break;

            case "information":
               type = EventLogEntryType.Information; break;

            case "successaudit":
               type = EventLogEntryType.SuccessAudit; break;

            case "warning":
               type = EventLogEntryType.Warning; break;
         }

         int id = int.Parse(idString);

         if (!descriptionProvided)
         {
            var buffer = new StringBuilder();

            string input;

            while ((input = Console.ReadLine()) != null)
            {
               buffer.AppendLine(input);
            }

            message = buffer.ToString();
         }

         EventLog.WriteEntry(source, message, type, id);
      }

      private static void showUsage()
      {
         Console.WriteLine(@"
eventcreate /L logname /SO source /ID eventid /T type [/D description]

Description:
    This command line tool enables an administrator to create
    a custom event ID and message in a specified event log. 
    If the /D switch is not provided the program will expect 
    the description to be sent to its standard in. This is useful 
    for sending large streams of text with special characters such 
    as new line and quotation marks.

Parameter List:

    /L    logname          Specifies the event log to create
                           an event in. This can be a custom event log.
                           If the log does not already exist, then one
                           will be created automatically.

    /T    type             Specifies the type of event to create.
                           Valid types: ERROR, WARNING, INFORMATION.

    /SO   source           Specifies the source to use for the
                           event (if not specified, source will default
                           to 'eventcreate'). A valid source can be any
                           string and should represent the application
                           or component that is generating the event.

    /ID   id               Specifies the event ID for the event. A
                           valid custom message ID is in the range
                           of 1 - 1000.

    /D    description      Specifies the description text for the new event.

    /?                     Displays this help message.


Examples:
    EVENTCREATE /T ERROR /ID 1000
        /L APPLICATION /D ""My custom error event for the application log""

    EVENTCREATE /T ERROR /ID 999 /L APPLICATION
        /SO WinWord /D ""Winword event 999 happened due to low diskspace""");
      }
   }
}
